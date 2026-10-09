import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { demoService } from '../../src/fixtures/demoService'
import { createApiServer } from './api'
import { readConfig } from './config'
import { runMigrations } from './migrate'
import { PostgresServiceRepository } from './PostgresServiceRepository'
import { validateServiceRecord } from './validateRecord'

describe('M8A record boundary', () => {
  it('accepts a valid Service 0.1 and an empty editor draft', () => {
    expect(validateServiceRecord(demoService)).toEqual(demoService)
    const draft = {
      ...demoService,
      service: { ...demoService.service, items: [] },
    }
    expect(validateServiceRecord(draft)).toEqual(draft)
  })

  it('rejects corrupt service items without changing Service 0.1', () => {
    const corrupt = structuredClone(demoService)
    corrupt.service.items[1].id = corrupt.service.items[0].id
    expect(() => validateServiceRecord(corrupt)).toThrow(/duplicate id/)
  })

  it('requires explicit database configuration', () => {
    expect(() => readConfig({})).toThrow(/DATABASE_URL/)
    expect(() => readConfig({ DATABASE_URL: 'https://example.com' })).toThrow(
      /postgres/,
    )
  })
})

const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('PostgreSQL + API integration', () => {
  const pool = new Pool({ connectionString: databaseUrl })
  const repository = new PostgresServiceRepository(pool)
  const server = createApiServer(repository, pool)
  let base: string
  const id = `m8a-test-${randomUUID()}`
  const record = {
    ...structuredClone(demoService),
    id,
    service: { ...structuredClone(demoService.service), id },
  }

  beforeAll(async () => {
    await runMigrations(pool)
    expect(await runMigrations(pool)).toEqual([])
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await repository.remove(id)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await pool.end()
  })

  it('persists, reorders, reloads and deletes a service through the HTTP API', async () => {
    const created = await fetch(`${base}/api/services`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(record),
    })
    expect(created.status).toBe(201)

    const reopened = await fetch(`${base}/api/services/${id}`)
    expect(reopened.status).toBe(200)
    expect(await reopened.json()).toEqual(record)

    const revised = {
      ...record,
      service: {
        ...record.service,
        items: [...record.service.items].reverse(),
      },
    }
    const updated = await fetch(`${base}/api/services/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(revised),
    })
    expect(updated.status).toBe(200)
    expect(await (await fetch(`${base}/api/services/${id}`)).json()).toEqual(
      revised,
    )

    const freshRepository = new PostgresServiceRepository(pool)
    expect(
      (await freshRepository.get(id))?.service.items.map((item) => item.id),
    ).toEqual(revised.service.items.map((item) => item.id))
    expect(
      (await (await fetch(`${base}/api/services`)).json()).some(
        (item: { id: string }) => item.id === id,
      ),
    ).toBe(true)

    expect(
      (await fetch(`${base}/api/services/${id}`, { method: 'DELETE' })).status,
    ).toBe(200)
    expect((await fetch(`${base}/api/services/${id}`)).status).toBe(404)
  })

  it('does not persist invalid contract data', async () => {
    const invalid = {
      ...record,
      service: { ...record.service, schemaVersion: '0.2' },
    }
    const response = await fetch(`${base}/api/services`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(invalid),
    })
    expect(response.status).toBe(400)
    expect(await repository.get(id)).toBeNull()
  })

  it('persists an empty editor draft before its first item exists', async () => {
    const draftId = `m8b-draft-${randomUUID()}`
    const draft = {
      ...structuredClone(demoService),
      id: draftId,
      service: {
        ...structuredClone(demoService.service),
        id: draftId,
        items: [],
      },
    }
    try {
      const created = await fetch(`${base}/api/services`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      })
      expect(created.status).toBe(201)
      expect((await repository.get(draftId))?.service.items).toEqual([])
    } finally {
      await repository.remove(draftId)
    }
  })
})
