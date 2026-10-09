import type { ServiceRecord } from '../domain/service/service'

export type PersistenceStatus = {
  mode: 'local' | 'postgres'
  phase: 'loading' | 'pending' | 'synced' | 'error'
  message?: string
  conflicts: number
}

export interface ServiceRepository {
  list(): ServiceRecord[]
  get(id: string): ServiceRecord | null
  save(record: ServiceRecord): void
  remove(id: string): void
  subscribe(listener: () => void): () => void
  ready(): Promise<void>
  retry(): Promise<void>
  status(): PersistenceStatus
  migrationConflicts(): ServiceRecord[]
}
