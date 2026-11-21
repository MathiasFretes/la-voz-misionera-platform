import type { ServiceRecord } from '../../domain/service/service'
import type { PersistenceStatus, ServiceRepository } from '../ServiceRepository'
import {
  PlanningJournal,
  type JournalEntry,
  type PlanConflict,
  type PlanOperation,
} from './PlanningJournal'

type Optimistic = {
  token: string
  generation: number
  record: ServiceRecord | null
}
/** Durable per-plan journal; late acknowledgements never replace a newer generation. */
export class JournalServiceRepository implements ServiceRepository {
  private readonly journal: PlanningJournal
  private readonly listeners = new Set<() => void>()
  private readonly optimistic = new Map<string, Optimistic>()
  private entries = new Map<string, JournalEntry>()
  private conflicts: PlanConflict[] = []
  private mutations: Promise<void> = Promise.resolve()
  private initialization: Promise<void> | null = null
  private flushing: Promise<void> | null = null
  private readonly abort = new AbortController()
  private readonly channel: BroadcastChannel | null
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly polling: ReturnType<typeof setInterval>
  private disposed = false
  private current: PersistenceStatus = {
    mode: 'postgres',
    phase: 'loading',
    conflicts: 0,
  }
  readonly userId: string
  readonly churchId: string
  readonly canEdit: boolean
  private readonly clientId: string
  private readonly fetcher: typeof fetch

  constructor(
    userId: string,
    churchId: string,
    canEdit: boolean,
    clientId: string,
    fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.userId = userId
    this.churchId = churchId
    this.canEdit = canEdit
    this.clientId = clientId
    this.fetcher = fetcher
    this.journal = new PlanningJournal(userId, churchId, clientId)
    this.channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(`lvm.service.plans:${this.journal.scope}`)
    if (this.channel)
      this.channel.onmessage = () => {
        void this.mutations
          .then(() => this.reload())
          .then(() => this.schedule())
          .catch((error) => this.error(error))
      }
    this.polling = setInterval(() => {
      if (!this.disposed) void this.retry()
    }, 30000)
    window.addEventListener('online', this.online)
    window.addEventListener('beforeunload', this.beforeUnload)
  }
  private readonly online = () => {
    void this.retry()
  }
  private readonly beforeUnload = (event: BeforeUnloadEvent) => {
    if (this.optimistic.size) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  status() {
    return this.current
  }
  list() {
    const rows = new Map(
      [...this.entries.values()].map((entry) => [entry.id, entry.record]),
    )
    for (const conflict of this.conflicts)
      if (conflict.clientId === this.clientId)
        rows.set(conflict.id, conflict.record)
    for (const [id, value] of this.optimistic) rows.set(id, value.record)
    return [...rows.values()]
      .filter((record): record is ServiceRecord => !!record)
      .sort((a, b) => b.service.startsAt.localeCompare(a.service.startsAt))
  }
  get(id: string) {
    return this.list().find((record) => record.id === id) || null
  }
  migrationConflicts() {
    return this.conflicts
      .map((conflict) => conflict.record || conflict.deletedRecord)
      .filter((record): record is ServiceRecord => !!record)
  }
  syncConflicts() {
    return this.conflicts
  }
  save(record: ServiceRecord) {
    this.mutate(record.id, record)
  }
  remove(id: string) {
    this.mutate(id, null)
  }
  private mutate(id: string, record: ServiceRecord | null) {
    if (!this.canEdit)
      throw new Error('Tu membresía permite consultar los servicios')
    if (this.disposed)
      throw new Error('Volvé a abrir la planificación de esta iglesia')
    const generation =
      this.optimistic.get(id)?.generation ??
      this.entries.get(id)?.generation ??
      0
    const token = crypto.randomUUID()
    const deletedRecord = record ? undefined : this.get(id) || undefined
    this.optimistic.set(id, { token, generation: generation + 1, record })
    this.setStatus('saving-local')
    this.mutations = this.mutations
      .then(async () => {
        await this.journal.mutate(id, generation, record, deletedRecord)
        if (this.optimistic.get(id)?.token === token) this.optimistic.delete(id)
        await this.reload()
        this.channel?.postMessage('changed')
        this.schedule()
      })
      .catch((error) => this.error(error))
  }
  private async reload() {
    const snapshot = await this.journal.snapshot()
    this.entries = new Map(snapshot.entries.map((entry) => [entry.id, entry]))
    this.conflicts = snapshot.conflicts
    this.setStatus(
      this.optimistic.size
        ? 'saving-local'
        : this.hasPending()
          ? 'pending'
          : this.conflicts.length
            ? 'error'
            : 'synced',
      this.conflicts.length
        ? 'Hay cambios que necesitan una resolución explícita.'
        : undefined,
    )
  }
  private hasPending() {
    return (
      this.optimistic.size ||
      [...this.entries.values()].some(
        (entry) => !entry.conflict && (entry.pending || entry.inFlight),
      )
    )
  }
  ready(): Promise<void> {
    if (!this.initialization) this.initialization = this.initialize()
    return this.initialization
  }
  private async initialize() {
    try {
      await this.reload()
      await this.refresh()
      await this.flush()
    } catch (error) {
      this.error(error)
    }
  }
  async retry() {
    if (this.disposed) return
    await this.ready()
    try {
      await this.mutations
      await this.refresh()
      await this.flush()
    } catch (error) {
      this.error(error)
    }
  }
  private async refresh() {
    const rows = await this.request('GET')
    if (!Array.isArray(rows))
      throw new Error('La API devolvió una lista inválida')
    const records = rows as ServiceRecord[]
    if (
      records.some(
        (record) =>
          !record?.id ||
          record.service?.id !== record.id ||
          !Number.isSafeInteger(record.revision) ||
          record.revision! < 1,
      )
    )
      throw new Error('La API devolvió servicios inválidos')
    await this.journal.ingest(records)
    await this.reload()
    this.channel?.postMessage('changed')
  }
  async flush(): Promise<void> {
    if (this.disposed || !this.canEdit) return
    if (this.flushing) return this.flushing
    this.flushing = this.flushOperations().finally(() => {
      this.flushing = null
    })
    return this.flushing
  }
  private async flushOperations() {
    try {
      await this.mutations
      for (let count = 0; count < 100 && !this.disposed; count++) {
        const next = await this.journal.next()
        if (!next) break
        const { entry, operation } = next
        const result = await this.request(
          operation.record ? 'PUT' : 'DELETE',
          entry.id,
          operation,
        )
        if (result.status === 'conflict') {
          await this.journal.rejectRevision(entry.id, operation.id)
        } else {
          if (!Number.isSafeInteger(result.revision) || result.revision < 0)
            throw new Error('El servidor no confirmó la revisión del servicio')
          await this.journal.acknowledge(
            entry.id,
            operation.id,
            operation.record
              ? result
              : { deleted: true, revision: result.revision },
          )
        }
        await this.reload()
        this.channel?.postMessage('changed')
      }
      await this.reload()
      if (this.hasPending()) this.schedule()
    } catch (error) {
      this.error(error)
    }
  }
  private async request(
    method: string,
    id?: string,
    operation?: PlanOperation,
  ) {
    const headers: Record<string, string> = { 'X-LVM-Account': this.userId }
    let body: string | undefined
    if (operation) {
      headers['Content-Type'] = 'application/json'
      headers['X-LVM-Operation'] = operation.id
      if (operation.record) {
        const record = { ...operation.record }
        delete record.revision
        body = JSON.stringify({
          ...record,
          ...(operation.expectedRevision
            ? { revision: operation.expectedRevision }
            : {}),
        })
      } else
        body = JSON.stringify({
          revision: operation.expectedRevision || 0,
          ...(!operation.expectedRevision
            ? { record: operation.deletedRecord }
            : {}),
        })
    }
    const response = await this.fetcher(
      `/api/churches/${this.churchId}/services${id ? `/${encodeURIComponent(id)}` : ''}`,
      {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers,
        body,
        signal: this.abort.signal,
      },
    )
    const result = await response.json()
    if (response.status === 409) return { status: 'conflict' as const }
    if (!response.ok)
      throw new Error(
        result.message || `No se pudo sincronizar (${response.status})`,
      )
    return result
  }
  async resolveConflict(key: string, choice: 'local' | 'remote') {
    if (choice === 'local' && !this.canEdit)
      throw new Error('Tu membresía permite consultar los servicios')
    await this.mutations
    const conflict = this.conflicts.find((row) => row.key === key)
    if (!conflict) throw new Error('El conflicto ya no está disponible')
    const generation = this.entries.get(conflict.id)?.generation || 0
    const records = (await this.request('GET')) as ServiceRecord[]
    if (!Array.isArray(records))
      throw new Error('No se pudo recuperar la versión del servidor')
    await this.journal.resolve(
      key,
      choice,
      records.find((record) => record.id === conflict.id) || null,
      generation,
    )
    await this.reload()
    this.channel?.postMessage('changed')
    await this.flush()
  }
  async waitForLocalWrites() {
    await this.mutations
    if (this.optimistic.size)
      throw new Error(
        'Hay cambios que todavía no se pudieron conservar en este dispositivo. Exportalos antes de cambiar de iglesia.',
      )
  }
  private schedule() {
    if (this.disposed || !this.canEdit || this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, 350)
  }
  private setStatus(phase: PersistenceStatus['phase'], message?: string) {
    if (this.disposed) return
    this.current = {
      mode: 'postgres',
      phase,
      conflicts: this.conflicts.length,
      ...(message ? { message } : {}),
    }
    for (const listener of this.listeners) listener()
  }
  private error(error: unknown) {
    if (!this.disposed)
      this.setStatus(
        'error',
        error instanceof Error
          ? error.message
          : 'No se pudo conservar o sincronizar el plan',
      )
  }
  async dispose() {
    this.disposed = true
    this.abort.abort()
    if (this.timer) clearTimeout(this.timer)
    clearInterval(this.polling)
    this.channel?.close()
    window.removeEventListener('online', this.online)
    window.removeEventListener('beforeunload', this.beforeUnload)
    await this.mutations
    await this.flushing
    await this.initialization
    await this.journal.close()
  }
}
