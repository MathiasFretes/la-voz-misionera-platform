import type { ServiceRecord } from '../../domain/service/service'
import type { PersistenceStatus, ServiceRepository } from '../ServiceRepository'

const STORAGE_KEY = 'lvm.platform.services.v1'

function isRecord(value: unknown): value is ServiceRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<ServiceRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.venue === 'string' &&
    !!record.service &&
    record.service.id === record.id
  )
}

export class LocalServiceRepository implements ServiceRepository {
  private listeners = new Set<() => void>()
  private storage: Storage
  private key: string

  constructor(storage: Storage, key = STORAGE_KEY) {
    this.storage = storage
    this.key = key
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === this.key) this.notify()
      })
    }
  }

  list(): ServiceRecord[] {
    try {
      const raw = this.storage.getItem(this.key)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (!Array.isArray(parsed)) return []
      return parsed
        .filter(isRecord)
        .sort((a, b) => b.service.startsAt.localeCompare(a.service.startsAt))
    } catch {
      return []
    }
  }

  get(id: string): ServiceRecord | null {
    return this.list().find((record) => record.id === id) ?? null
  }

  save(record: ServiceRecord): void {
    const records = this.list().filter((item) => item.id !== record.id)
    records.push(record)
    this.storage.setItem(this.key, JSON.stringify(records))
    this.notify()
  }

  remove(id: string): void {
    this.storage.setItem(
      this.key,
      JSON.stringify(this.list().filter((item) => item.id !== id)),
    )
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async ready(): Promise<void> {}

  async retry(): Promise<void> {}

  status(): PersistenceStatus {
    return { mode: 'local', phase: 'synced', conflicts: 0 }
  }

  migrationConflicts(): ServiceRecord[] {
    return []
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }
}
