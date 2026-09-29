import type { ServiceRecord } from '../domain/service/service'

export interface ServiceRepository {
  list(): ServiceRecord[]
  get(id: string): ServiceRecord | null
  save(record: ServiceRecord): void
  remove(id: string): void
  subscribe(listener: () => void): () => void
}
