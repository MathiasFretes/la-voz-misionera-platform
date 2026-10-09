import type { ServiceRecord } from '../../domain/service/service'
import type { PersistenceStatus, ServiceRepository } from '../ServiceRepository'
import { LocalServiceRepository } from '../local/LocalServiceRepository'

const MIGRATED_KEY = 'lvm.service.postgres-migrated.v1'
const WRITES_KEY = 'lvm.service.pending-writes.v1'
const DELETES_KEY = 'lvm.service.pending-deletes.v1'
const CONFLICTS_KEY = 'lvm.service.migration-conflicts.v1'

function storedIds(storage: Storage, key: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? '[]')
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : [],
    )
  } catch {
    return new Set()
  }
}

function storedRecords(storage: Storage, key: string): ServiceRecord[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter(
          (value): value is ServiceRecord =>
            !!value &&
            typeof value === 'object' &&
            typeof value.id === 'string',
        )
      : []
  } catch {
    return []
  }
}

export class ApiServiceRepository implements ServiceRepository {
  private readonly storage: Storage
  private readonly fetcher: typeof fetch
  private readonly cache: LocalServiceRepository
  private readonly listeners = new Set<() => void>()
  private readonly writes: Set<string>
  private readonly deletes: Set<string>
  private current: PersistenceStatus
  private initialization: Promise<void> | null = null
  private flushPromise: Promise<void> | null = null
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private initialized = false

  constructor(
    storage: Storage,
    fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.storage = storage
    this.fetcher = fetcher
    this.cache = new LocalServiceRepository(storage)
    this.writes = storedIds(storage, WRITES_KEY)
    this.deletes = storedIds(storage, DELETES_KEY)
    this.current = {
      mode: 'postgres',
      phase: 'loading',
      conflicts: storedRecords(storage, CONFLICTS_KEY).length,
    }
  }

  list(): ServiceRecord[] {
    return this.cache.list()
  }

  get(id: string): ServiceRecord | null {
    return this.cache.get(id)
  }

  save(record: ServiceRecord): void {
    this.cache.save(record)
    this.writes.add(record.id)
    this.deletes.delete(record.id)
    this.persistQueue()
    this.setStatus('pending')
    this.scheduleFlush()
  }

  remove(id: string): void {
    this.cache.remove(id)
    this.writes.delete(id)
    this.deletes.add(id)
    this.persistQueue()
    this.setStatus('pending')
    this.scheduleFlush()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  status(): PersistenceStatus {
    return this.current
  }

  migrationConflicts(): ServiceRecord[] {
    return storedRecords(this.storage, CONFLICTS_KEY)
  }

  ready(): Promise<void> {
    if (this.initialized) return Promise.resolve()
    if (!this.initialization) {
      this.initialization = this.initialize().finally(() => {
        this.initialization = null
      })
    }
    return this.initialization
  }

  async retry(): Promise<void> {
    this.initialized = false
    await this.ready()
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    await this.ready()
    if (!this.initialized || this.flushPromise)
      return this.flushPromise ?? undefined
    this.flushPromise = this.flushPending().finally(() => {
      this.flushPromise = null
      if (this.current.phase === 'pending') this.scheduleFlush()
    })
    return this.flushPromise
  }

  private async initialize(): Promise<void> {
    this.setStatus('loading')
    try {
      const remote = await this.request<ServiceRecord[]>('/api/services')
      if (!Array.isArray(remote))
        throw new Error('La API devolvió una lista inválida')
      const merged = new Map(remote.map((record) => [record.id, record]))
      const migrating = this.storage.getItem(MIGRATED_KEY) !== 'true'
      if (migrating) {
        for (const local of this.cache.list()) {
          if (this.deletes.has(local.id) || this.writes.has(local.id)) continue
          const existing = merged.get(local.id)
          if (!existing) {
            await this.put(local)
            merged.set(local.id, local)
          } else if (JSON.stringify(existing) !== JSON.stringify(local)) {
            this.backupConflict(local)
          }
        }
        this.storage.setItem(MIGRATED_KEY, 'true')
      }

      for (const id of [...this.deletes]) {
        await this.request(
          `/api/services/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
          true,
        )
        this.deletes.delete(id)
        merged.delete(id)
        this.persistQueue()
      }
      for (const id of [...this.writes]) {
        const local = this.cache.get(id)
        if (!local) continue
        await this.put(local)
        merged.set(id, local)
        if (JSON.stringify(this.cache.get(id)) === JSON.stringify(local)) {
          this.writes.delete(id)
          this.persistQueue()
        }
      }

      // An edit made while the initial request was in flight always stays visible.
      for (const id of this.writes) {
        const local = this.cache.get(id)
        if (local) merged.set(id, local)
      }
      for (const id of this.deletes) merged.delete(id)
      for (const local of this.cache.list()) {
        if (!merged.has(local.id)) this.cache.remove(local.id)
      }
      for (const record of merged.values()) {
        if (
          JSON.stringify(this.cache.get(record.id)) !== JSON.stringify(record)
        ) {
          this.cache.save(record)
        }
      }
      this.initialized = true
      this.setStatus(
        this.writes.size || this.deletes.size ? 'pending' : 'synced',
      )
    } catch (error) {
      this.setStatus(
        'error',
        error instanceof Error
          ? error.message
          : 'No se pudo conectar con la API',
      )
    }
  }

  private async flushPending(): Promise<void> {
    try {
      for (const id of [...this.deletes]) {
        await this.request(
          `/api/services/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
          true,
        )
        this.deletes.delete(id)
        this.persistQueue()
      }
      for (const id of [...this.writes]) {
        const record = this.cache.get(id)
        if (!record) continue
        await this.put(record)
        if (JSON.stringify(this.cache.get(id)) === JSON.stringify(record)) {
          this.writes.delete(id)
          this.persistQueue()
        }
      }
      this.setStatus(
        this.writes.size || this.deletes.size ? 'pending' : 'synced',
      )
    } catch (error) {
      this.setStatus(
        'error',
        error instanceof Error
          ? error.message
          : 'No se pudo guardar en PostgreSQL',
      )
    }
  }

  private async put(record: ServiceRecord): Promise<void> {
    await this.request(`/api/services/${encodeURIComponent(record.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(record),
    })
  }

  private async request<T = unknown>(
    path: string,
    init?: RequestInit,
    allowMissing = false,
  ): Promise<T> {
    const response = await this.fetcher(path, init)
    if (!response.ok && !(allowMissing && response.status === 404)) {
      let message = `Error ${response.status} al acceder a Service API`
      try {
        const body: unknown = await response.json()
        if (
          body &&
          typeof body === 'object' &&
          'error' in body &&
          typeof body.error === 'string'
        ) {
          message = body.error
        }
      } catch {
        /* Keep the status message. */
      }
      throw new Error(message)
    }
    if (allowMissing && response.status === 404) return undefined as T
    return (await response.json()) as T
  }

  private backupConflict(record: ServiceRecord): void {
    const conflicts = this.migrationConflicts()
    if (!conflicts.some((item) => item.id === record.id)) {
      conflicts.push(record)
      this.storage.setItem(CONFLICTS_KEY, JSON.stringify(conflicts))
      this.current = { ...this.current, conflicts: conflicts.length }
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flush()
    }, 400)
  }

  private persistQueue(): void {
    this.storage.setItem(WRITES_KEY, JSON.stringify([...this.writes]))
    this.storage.setItem(DELETES_KEY, JSON.stringify([...this.deletes]))
  }

  private setStatus(phase: PersistenceStatus['phase'], message?: string): void {
    this.current = {
      mode: 'postgres',
      phase,
      conflicts: this.migrationConflicts().length,
      ...(message ? { message } : {}),
    }
    this.listeners.forEach((listener) => listener())
  }
}
