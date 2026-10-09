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
  const records = new Map(initial.map((record) => [record.id, record]))
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
      records.set(id, record)
      return Response.json(record)
    }
    if (method === 'DELETE') {
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
    expect(api.records.get(draft.id)).toEqual(draft)
    expect(repository.status().phase).toBe('synced')
    expect(
      new ApiServiceRepository(localStorage, api.fetcher).get(draft.id),
    ).toEqual(draft)
  })

  it('keeps an accessible backup when a local ID conflicts with the server', async () => {
    const local = copy('shared-id', 'Versión del navegador')
    const remote = copy('shared-id', 'Versión del servidor')
    new LocalServiceRepository(localStorage).save(local)
    const api = fakeApi([remote])
    const repository = new ApiServiceRepository(localStorage, api.fetcher)

    await repository.ready()
    expect(repository.get(local.id)).toEqual(remote)
    expect(repository.migrationConflicts()).toEqual([local])
    expect(repository.status().conflicts).toBe(1)
    expect(api.records.get(local.id)).toEqual(remote)
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
    expect(api.records.get(draft.id)).toEqual(draft)
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
    expect(reopened.get(draft.id)).toEqual(draft)
    expect(api.records.get(draft.id)).toEqual(draft)
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
})
