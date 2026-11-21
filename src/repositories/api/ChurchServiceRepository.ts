import { ApiServiceRepository } from './ApiServiceRepository'
import type { ServiceRepository } from '../ServiceRepository'

/** All caches, pending writes and conflict copies belong to one account and church. */
export function churchStorage(
  storage: Storage,
  userId: string,
  churchId: string,
): Storage {
  const prefix = `lvm.service.scope.v1.${encodeURIComponent(userId)}.${encodeURIComponent(churchId)}.`
  const keys = () =>
    Array.from({ length: storage.length }, (_, index) =>
      storage.key(index),
    ).filter((key): key is string => !!key?.startsWith(prefix))
  return {
    get length() {
      return keys().length
    },
    key(index) {
      return keys()[index]?.slice(prefix.length) ?? null
    },
    getItem(key) {
      return storage.getItem(prefix + key)
    },
    setItem(key, value) {
      storage.setItem(prefix + key, value)
    },
    removeItem(key) {
      storage.removeItem(prefix + key)
    },
    clear() {
      for (const key of keys()) storage.removeItem(key)
    },
  }
}

export function createChurchServiceRepository(
  storage: Storage,
  userId: string,
  churchId: string,
  canEdit: boolean,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): ServiceRepository {
  if (
    !userId ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      churchId,
    )
  )
    throw new Error('Seleccioná una iglesia válida')
  const scopedFetch: typeof fetch = async (input, init) => {
    if (typeof input !== 'string' || !/^\/api\/services(?:\/|$)/.test(input))
      throw new Error('Ruta de planificación inválida')
    const headers = new Headers(init?.headers)
    let body = init?.body
    if (init?.method === 'DELETE') {
      const revision = Number(headers.get('if-match'))
      if (!Number.isSafeInteger(revision) || revision < 1)
        throw new Error(
          'El servicio todavía no tiene una revisión del servidor',
        )
      headers.delete('if-match')
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify({ revision })
    }
    return fetcher(
      input.replace('/api/services', `/api/churches/${churchId}/services`),
      { ...init, headers, body, credentials: 'same-origin', cache: 'no-store' },
    )
  }
  const repository = new ApiServiceRepository(
    churchStorage(storage, userId, churchId),
    scopedFetch,
  )
  return {
    list: () => repository.list(),
    get: (id) => repository.get(id),
    save: (record) => {
      if (!canEdit)
        throw new Error('Tu membresía permite consultar los servicios')
      repository.save(record)
    },
    remove: (id) => {
      if (!canEdit)
        throw new Error('Tu membresía permite consultar los servicios')
      repository.remove(id)
    },
    subscribe: (listener) => repository.subscribe(listener),
    ready: () => repository.ready(),
    retry: () => repository.retry(),
    status: () => repository.status(),
    migrationConflicts: () => repository.migrationConflicts(),
  }
}
