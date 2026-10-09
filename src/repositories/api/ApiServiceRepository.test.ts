import { beforeEach, describe, expect, it } from 'vitest'
import { demoService } from '../../fixtures/demoService'
import type { ServiceRecord } from '../../domain/service/service'
import { LocalServiceRepository } from '../local/LocalServiceRepository'
import { ApiServiceRepository } from './ApiServiceRepository'

function copy(id: string, title: string): ServiceRecord {
  const record = structuredClone(demoService)
  record.id = id
  record.service.id = id
  record.service.title = title
  return record
}

function fakeApi(initial: ServiceRecord[] = []) {
  const records = new Map(
    initial.map((record) => [record.id, { ...record, revision: 1 }]),
  )
  const calls: string[] = []
  let offline = false
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (offline) throw new Error('Sin conexión')
    const path = String(input)
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${path}`)
    if (path === '/api/services' && method === 'GET') {
      return Response.json([...records.values()])
    }
    const id = decodeURIComponent(path.slice('/api/services/'.length))
    if (method === 'PUT') {
      const record = JSON.parse(String(init?.body)) as ServiceRecord
      const existing = records.get(id)
      if (
        (existing && record.revision !== existing.revision) ||
        (!existing && record.revision !== undefined)
      ) {
        return Response.json(
          { error: 'Service changed in another session' },
          { status: 409 },
        )
      }
      const saved = { ...record, revision: (existing?.revision ?? 0) + 1 }
      records.set(id, saved)
      return Response.json(saved)
    }
    if (method === 'DELETE') {
      const expected = new Headers(init?.headers).get('if-match')
      const current = records.get(id)
      if (expected && current && Number(expected) !== current.revision)
        return Response.json(
          { error: 'Service changed in another session' },
          { status: 409 },
        )
      const found = records.delete(id)
      return Response.json(found ? { deleted: true } : { error: 'Not found' }, {
        status: found ? 200 : 404,
      })
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  return {
    records,
    calls,
    fetcher: fetcher as typeof fetch,
    setOffline: (value: boolean) => {
      offline = value
    },
  }
}

describe('ApiServiceRepository', () => {
  beforeEach(() => localStorage.clear())

  it('migrates existing browser drafts without deleting them before server confirmation', async () => {
    const draft = copy('local-draft', 'Culto local')
    new LocalServiceRepository(localStorage).save(draft)
    const api = fakeApi()
    const repository = new ApiServiceRepository(localStorage, api.fetcher)
    expect(repository.get(draft.id)).toEqual(draft)

    await repository.ready()
    expect(api.records.get(draft.id)).toEqual({ ...draft, revision: 1 })
    expect(repository.status().phase).toBe('synced')
    expect(
      new ApiServiceRepository(localStorage, api.fetcher).get(draft.id),
    ).toEqual({
      ...draft,
      revision: 1,
    })
  })

  it('keeps an accessible backup when a local ID conflicts with the server', async () => {
    const local = copy('shared-id', 'Versión del navegador')
    const remote = copy('shared-id', 'Versión del servidor')
    new LocalServiceRepository(localStorage).save(local)
    const api = fakeApi([remote])
    const repository = new ApiServiceRepository(localStorage, api.fetcher)

    await repository.ready()
    expect(repository.get(local.id)).toEqual({ ...remote, revision: 1 })
    expect(repository.migrationConflicts()).toEqual([local])
    expect(repository.status().conflicts).toBe(1)
    expect(api.records.get(local.id)).toEqual({ ...remote, revision: 1 })
  })

  it('retains edits offline and synchronizes them after retry', async () => {
    const api = fakeApi()
    api.setOffline(true)
    const repository = new ApiServiceRepository(localStorage, api.fetcher)
    await repository.ready()
    expect(repository.status().phase).toBe('error')

    const draft = copy('offline-draft', 'Preparado sin red')
    repository.save(draft)
    expect(repository.get(draft.id)).toEqual(draft)
    api.setOffline(false)
    await repository.retry()
    expect(api.records.get(draft.id)).toEqual({ ...draft, revision: 1 })
    expect(repository.status().phase).toBe('synced')
  })

  it('resends an offline draft after the browser repository is recreated', async () => {
    const api = fakeApi()
    api.setOffline(true)
    const first = new ApiServiceRepository(localStorage, api.fetcher)
    await first.ready()
    const draft = copy('after-reload', 'Culto preparado sin red')
    first.save(draft)
    await first.flush()

    api.setOffline(false)
    const reopened = new ApiServiceRepository(localStorage, api.fetcher)
    await reopened.ready()
    expect(reopened.get(draft.id)).toEqual({ ...draft, revision: 1 })
    expect(api.records.get(draft.id)).toEqual({ ...draft, revision: 1 })
    expect(reopened.status().phase).toBe('synced')
  })

  it('coalesces rapid edits and persists deletion', async () => {
    const api = fakeApi()
    const repository = new ApiServiceRepository(localStorage, api.fetcher)
    await repository.ready()
    repository.save(copy('rapid', 'Primera versión'))
    repository.save(copy('rapid', 'Versión final'))
    await repository.flush()
    expect(api.records.get('rapid')?.service.title).toBe('Versión final')
    expect(
      api.calls.filter((call) => call === 'PUT /api/services/rapid'),
    ).toHaveLength(1)

    repository.remove('rapid')
    await repository.flush()
    expect(api.records.has('rapid')).toBe(false)
    expect(repository.get('rapid')).toBeNull()
  })

  it('keeps and backs up a stale local edit instead of overwriting a newer server revision', async () => {
    const original = copy('shared', 'Primer título')
    const api = fakeApi([original])
    const repository = new ApiServiceRepository(localStorage, api.fetcher)
    await repository.ready()
    const fromAnotherSession = {
      ...original,
      revision: 1,
      service: { ...original.service, title: 'Cambio remoto' },
    }
    const remoteResponse = await api.fetcher('/api/services/shared', {
      method: 'PUT',
      body: JSON.stringify(fromAnotherSession),
    })
    expect(remoteResponse.status).toBe(200)

    const local = repository.get('shared')!
    repository.save({
      ...local,
      service: { ...local.service, title: 'Cambio local' },
    })
    await repository.flush()
    expect(repository.status().phase).toBe('error')
    expect(repository.get('shared')?.service.title).toBe('Cambio local')
    expect(repository.migrationConflicts()[0].service.title).toBe(
      'Cambio local',
    )
    expect(api.records.get('shared')?.service.title).toBe('Cambio remoto')
  })

  it('does not delete a service changed by another session', async () => {
    const original = copy('delete-conflict', 'Título original')
    const api = fakeApi([original])
    const repository = new ApiServiceRepository(localStorage, api.fetcher)
    await repository.ready()
    await api.fetcher('/api/services/delete-conflict', {
      method: 'PUT',
      body: JSON.stringify({
        ...original,
        revision: 1,
        service: { ...original.service, title: 'Cambio remoto' },
      }),
    })
    repository.remove('delete-conflict')
    await repository.flush()
    expect(repository.status().phase).toBe('error')
    expect(api.records.get('delete-conflict')?.service.title).toBe(
      'Cambio remoto',
    )
    expect(repository.migrationConflicts()[0].service.title).toBe(
      'Título original',
    )
  })
})
