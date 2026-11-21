import type { ServiceRecord } from '../../domain/service/service'

export type PlanOperation = {
  id: string
  generation: number
  record: ServiceRecord | null
  deletedRecord?: ServiceRecord
  expectedRevision?: number
}
export type JournalEntry = {
  key: string
  scope: string
  id: string
  generation: number
  revision: number
  record: ServiceRecord | null
  pending: PlanOperation | null
  inFlight: PlanOperation | null
  conflict?: boolean
}
export type PlanConflict = {
  key: string
  scope: string
  id: string
  clientId: string
  record: ServiceRecord | null
  deletedRecord?: ServiceRecord
  reason: 'local-generation' | 'server-revision'
}

const request = <T>(operation: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result)
    operation.onerror = () => reject(operation.error)
  })
const completed = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () =>
      reject(transaction.error || new Error('No se pudo conservar el borrador'))
    transaction.onerror = () => reject(transaction.error)
  })

/** One IndexedDB transaction owns each local mutation and acknowledgement, across tabs. */
export class PlanningJournal {
  private readonly database: Promise<IDBDatabase>
  readonly scope: string
  readonly userId: string
  readonly churchId: string
  readonly clientId: string
  constructor(userId: string, churchId: string, clientId: string) {
    this.userId = userId
    this.churchId = churchId
    this.clientId = clientId
    this.scope = JSON.stringify([userId, churchId])
    this.database = new Promise((resolve, reject) => {
      const opening = indexedDB.open('lvm.service.planning.v1', 1)
      opening.onupgradeneeded = () => {
        for (const name of ['entries', 'conflicts']) {
          const store = opening.result.createObjectStore(name, {
            keyPath: 'key',
          })
          store.createIndex('scope', 'scope')
        }
      }
      opening.onsuccess = () => resolve(opening.result)
      opening.onerror = () => reject(opening.error)
      opening.onblocked = () =>
        reject(
          new Error(
            'Cerrá las otras pestañas para actualizar el almacenamiento',
          ),
        )
    })
  }
  private key(id: string) {
    return JSON.stringify([this.userId, this.churchId, id])
  }
  private async transaction<T>(
    stores: string[],
    action: (transaction: IDBTransaction) => Promise<T>,
  ): Promise<T> {
    const database = await this.database
    const transaction = database.transaction(stores, 'readwrite')
    const done = completed(transaction)
    try {
      const result = await action(transaction)
      await done
      return result
    } catch (error) {
      try {
        transaction.abort()
      } catch {
        /* Already terminal. */
      }
      await done.catch(() => {})
      throw error
    }
  }
  async snapshot(): Promise<{
    entries: JournalEntry[]
    conflicts: PlanConflict[]
  }> {
    const database = await this.database
    const transaction = database.transaction(
      ['entries', 'conflicts'],
      'readonly',
    )
    const done = completed(transaction)
    const [entries, conflicts] = await Promise.all([
      request(
        transaction.objectStore('entries').index('scope').getAll(this.scope),
      ),
      request(
        transaction.objectStore('conflicts').index('scope').getAll(this.scope),
      ),
    ])
    await done
    return { entries, conflicts }
  }
  async mutate(
    id: string,
    expectedGeneration: number,
    record: ServiceRecord | null,
    deletedRecord?: ServiceRecord,
  ) {
    return this.transaction(['entries', 'conflicts'], async (transaction) => {
      const store = transaction.objectStore('entries')
      const existing: JournalEntry | undefined = await request(
        store.get(this.key(id)),
      )
      if ((existing?.generation || 0) !== expectedGeneration) {
        const conflict: PlanConflict = {
          key: JSON.stringify([this.scope, id, this.clientId]),
          scope: this.scope,
          id,
          clientId: this.clientId,
          record,
          deletedRecord,
          reason: 'local-generation',
        }
        await request(transaction.objectStore('conflicts').put(conflict))
        return { conflict: true, generation: existing?.generation || 0 }
      }
      const generation = expectedGeneration + 1
      const entry: JournalEntry = {
        key: this.key(id),
        scope: this.scope,
        id,
        generation,
        revision: existing?.revision || 0,
        record,
        pending: { id: crypto.randomUUID(), generation, record, deletedRecord },
        inFlight: existing?.inFlight || null,
        conflict: existing?.conflict,
      }
      // Cancel creation entirely when it never left the device.
      if (!record && !entry.revision && !entry.inFlight) entry.pending = null
      await request(store.put(entry))
      return { conflict: false, generation }
    })
  }
  async next(): Promise<{
    entry: JournalEntry
    operation: PlanOperation
  } | null> {
    return this.transaction(['entries'], async (transaction) => {
      const store = transaction.objectStore('entries')
      const entries: JournalEntry[] = await request(
        store.index('scope').getAll(this.scope),
      )
      const entry = entries.find(
        (row) => !row.conflict && (row.inFlight || row.pending),
      )
      if (!entry) return null
      if (!entry.inFlight) {
        entry.inFlight = { ...entry.pending!, expectedRevision: entry.revision }
        entry.pending = null
        await request(store.put(entry))
      }
      return { entry, operation: entry.inFlight! }
    })
  }
  async acknowledge(
    id: string,
    operationId: string,
    response: ServiceRecord | { revision: number; deleted: true },
  ) {
    return this.transaction(['entries'], async (transaction) => {
      const store = transaction.objectStore('entries')
      const entry: JournalEntry | undefined = await request(
        store.get(this.key(id)),
      )
      if (!entry || entry.inFlight?.id !== operationId) return
      const sent = entry.inFlight
      entry.revision = response.revision || 0
      entry.inFlight = null
      if (entry.generation === sent.generation && !entry.pending)
        entry.record = 'deleted' in response ? null : response
      else if (entry.record)
        entry.record = { ...entry.record, revision: entry.revision }
      await request(store.put(entry))
    })
  }
  async rejectRevision(id: string, operationId: string) {
    return this.transaction(['entries', 'conflicts'], async (transaction) => {
      const store = transaction.objectStore('entries')
      const entry: JournalEntry | undefined = await request(
        store.get(this.key(id)),
      )
      if (!entry || entry.inFlight?.id !== operationId) return
      const conflict: PlanConflict = {
        key: JSON.stringify([this.scope, id, this.clientId]),
        scope: this.scope,
        id,
        clientId: this.clientId,
        record: entry.record,
        deletedRecord:
          entry.pending?.deletedRecord || entry.inFlight.deletedRecord,
        reason: 'server-revision',
      }
      await request(transaction.objectStore('conflicts').put(conflict))
      entry.conflict = true
      await request(store.put(entry))
    })
  }
  async ingest(records: ServiceRecord[]) {
    return this.transaction(['entries'], async (transaction) => {
      const store = transaction.objectStore('entries')
      const existing: JournalEntry[] = await request(
        store.index('scope').getAll(this.scope),
      )
      const remote = new Map(records.map((record) => [record.id, record]))
      for (const entry of existing) {
        const record = remote.get(entry.id)
        remote.delete(entry.id)
        if (entry.pending || entry.inFlight || entry.conflict) continue
        if (
          JSON.stringify(entry.record) === JSON.stringify(record || null) &&
          entry.revision === (record?.revision || 0)
        )
          continue
        entry.record = record || null
        entry.revision = record?.revision || 0
        entry.generation += 1
        await request(store.put(entry))
      }
      for (const record of remote.values()) {
        await request(
          store.put({
            key: this.key(record.id),
            scope: this.scope,
            id: record.id,
            generation: 1,
            revision: record.revision || 0,
            record,
            pending: null,
            inFlight: null,
          } satisfies JournalEntry),
        )
      }
    })
  }
  async resolve(
    conflictKey: string,
    choice: 'local' | 'remote',
    remote: ServiceRecord | null,
    expectedGeneration: number,
  ) {
    return this.transaction(['entries', 'conflicts'], async (transaction) => {
      const conflicts = transaction.objectStore('conflicts')
      const conflict: PlanConflict | undefined = await request(
        conflicts.get(conflictKey),
      )
      if (!conflict || conflict.scope !== this.scope)
        throw new Error('El conflicto ya no está disponible')
      const store = transaction.objectStore('entries')
      const entry: JournalEntry | undefined = await request(
        store.get(this.key(conflict.id)),
      )
      if (!entry || entry.generation !== expectedGeneration)
        throw new Error(
          'El plan volvió a cambiar. Revisá las versiones antes de resolver.',
        )
      entry.generation += 1
      entry.revision = remote?.revision || 0
      entry.inFlight = null
      entry.conflict = false
      entry.record = choice === 'local' ? conflict.record : remote
      entry.pending =
        choice === 'local'
          ? {
              id: crypto.randomUUID(),
              generation: entry.generation,
              record: conflict.record,
              deletedRecord: conflict.deletedRecord,
            }
          : null
      await request(store.put(entry))
      await request(conflicts.delete(conflict.key))
    })
  }
  async close() {
    ;(await this.database).close()
  }
}
