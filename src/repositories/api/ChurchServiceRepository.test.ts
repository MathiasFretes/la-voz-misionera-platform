import { beforeEach, expect, it, vi } from 'vitest'
import {
  churchStorage,
  createChurchServiceRepository,
} from './ChurchServiceRepository'

const church = '96a40990-fdd6-43e2-aa17-b30420fc5452'
beforeEach(() => {
  localStorage.clear()
})
it('isolates cached plans, pending queues and conflict copies by account and church', () => {
  const a = churchStorage(localStorage, 'account-a', church)
  const b = churchStorage(localStorage, 'account-b', church)
  const other = churchStorage(localStorage, 'account-a', 'other-church')
  localStorage.setItem('legacy-plans', 'keep')
  a.setItem('queue', 'private')
  expect(b.getItem('queue')).toBeNull()
  expect(other.getItem('queue')).toBeNull()
  expect(a.length).toBe(1)
  b.clear()
  expect(a.getItem('queue')).toBe('private')
  a.clear()
  expect(localStorage.getItem('legacy-plans')).toBe('keep')
})
it('fetches the explicit church with session cookies and never imports unscoped local plans', async () => {
  localStorage.setItem(
    'lvm.platform.services.v1',
    JSON.stringify([
      {
        id: 'legacy',
        venue: 'Original',
        service: { id: 'legacy', startsAt: '2026-12-01T12:00:00Z' },
      },
    ]),
  )
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('[]', { status: 200 }))
  const repository = createChurchServiceRepository(
    localStorage,
    'user-a',
    church,
    true,
    fetcher,
  )
  await repository.ready()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher).toHaveBeenCalledWith(
    `/api/churches/${church}/services`,
    expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }),
  )
  expect(repository.list()).toEqual([])
  expect(localStorage.getItem('lvm.platform.services.v1')).toContain('Original')
})
it('prevents read-only memberships from creating pending local writes', () => {
  const fetcher = vi.fn<typeof fetch>()
  const repository = createChurchServiceRepository(
    localStorage,
    'user-a',
    church,
    false,
    fetcher,
  )
  expect(() => repository.remove('service-a')).toThrow('consultar')
  expect(fetcher).not.toHaveBeenCalled()
  expect(churchStorage(localStorage, 'user-a', church).length).toBe(0)
})
