import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { WorshipReview, type WorshipExchange } from './WorshipReview'
import { demoService } from '../../fixtures/demoService'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const exchange: WorshipExchange = {
  context: {
    schemaVersion: '0.1',
    serviceId: demoService.id,
    title: demoService.service.title,
    startsAt: demoService.service.startsAt,
    setlistId: demoService.service.setlist.id,
    name: 'Música',
  },
  serviceRevision: 4,
  revision: 2,
  basedOnServiceRevision: 4,
  appliedPlanRevision: null,
  appliedServiceRevision: null,
  canPrepare: true,
  canApply: true,
  plan: {
    schemaVersion: '0.1',
    serviceId: demoService.id,
    setlistId: demoService.service.setlist.id,
    name: 'Música',
    songs: [
      {
        songId: 'song-a',
        title: 'Fiel',
        key: 'G',
        arrangement: [1],
        sections: [
          {
            kind: 'verse',
            label: 'Verso',
            lines: [{ text: 'Fiel', chords: [] }],
          },
        ],
      },
    ],
  },
}
const props = {
  userId: 'account-a',
  churchId: 'church-a',
  record: { ...demoService, revision: 4 },
  persistence: {
    mode: 'postgres' as const,
    phase: 'synced' as const,
    conflicts: 0,
  },
  refreshService: vi.fn().mockResolvedValue(undefined),
}
beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
  props.refreshService.mockResolvedValue(undefined)
})
function server(value = exchange, applyStatus = 200) {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_path, input) =>
      input?.method === 'POST'
        ? Response.json(
            applyStatus === 200
              ? { ...demoService, revision: 5 }
              : { message: 'El culto cambió' },
            { status: applyStatus },
          )
        : Response.json(value),
    )
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
it('requires explicit review and sends both revisions with the authenticated account', async () => {
  const fetcher = server()
  render(<WorshipReview {...props} />)
  await screen.findByText('Fiel', { exact: true })
  expect(fetcher.mock.calls.some(([, input]) => input?.method === 'POST')).toBe(
    false,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Revisar incorporación' }))
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar incorporación' }),
  )
  await screen.findByText(
    'Repertorio incorporado al culto. Los elementos manuales se conservaron.',
  )
  const post = fetcher.mock.calls.find(([, input]) => input?.method === 'POST')!
  expect(JSON.parse(String(post[1]?.body))).toEqual({
    revision: 2,
    serviceRevision: 4,
  })
  expect(new Headers(post[1]?.headers).get('X-LVM-Account')).toBe('account-a')
  expect(new Headers(post[1]?.headers).get('X-LVM-Operation')).toMatch(
    /^[a-f0-9-]{36}$/,
  )
  expect(props.refreshService).toHaveBeenCalledTimes(1)
})
it('keeps the proposal visible after a real revision rejection and reuses the operation on retry', async () => {
  const fetcher = server(exchange, 409)
  render(<WorshipReview {...props} />)
  await screen.findByText('Fiel', { exact: true })
  fireEvent.click(screen.getByRole('button', { name: 'Revisar incorporación' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar incorporación' }),
  )
  await screen.findByRole('alert')
  expect(screen.getByText('Fiel', { exact: true })).toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar incorporación' }),
  )
  await waitFor(() =>
    expect(
      fetcher.mock.calls.filter(([, input]) => input?.method === 'POST'),
    ).toHaveLength(2),
  )
  const posts = fetcher.mock.calls.filter(
    ([, input]) => input?.method === 'POST',
  )
  expect(new Headers(posts[0][1]?.headers).get('X-LVM-Operation')).toBe(
    new Headers(posts[1][1]?.headers).get('X-LVM-Operation'),
  )
  expect(props.refreshService).not.toHaveBeenCalled()
})
it('blocks incorporation for a stale context and for local edits awaiting synchronization', async () => {
  server({ ...exchange, basedOnServiceRevision: 3 })
  const view = render(<WorshipReview {...props} />)
  await screen.findByText(/Los músicos deben revisar el contexto actualizado/)
  expect(
    screen.queryByRole('button', { name: 'Revisar incorporación' }),
  ).toBeNull()
  view.unmount()
  server()
  render(
    <WorshipReview
      {...props}
      persistence={{ ...props.persistence, phase: 'pending' }}
    />,
  )
  await screen.findByText('Fiel', { exact: true })
  expect(
    screen.getByRole('button', { name: 'Revisar incorporación' }),
  ).toBeDisabled()
})
it('does not render global incorporation controls for a musician', async () => {
  server({ ...exchange, canApply: false })
  render(<WorshipReview {...props} />)
  await screen.findByText('Fiel', { exact: true })
  expect(
    screen.queryByRole('button', { name: 'Revisar incorporación' }),
  ).toBeNull()
  expect(
    screen.getByRole('link', { name: 'Preparar en Worship' }),
  ).toHaveAttribute('href', expect.stringContaining('churchId=church-a'))
})
it('recovers the operation UUID after the reviewer remounts following a lost acknowledgement', async () => {
  const fetcher = server(exchange, 503)
  const first = render(<WorshipReview {...props} />)
  await screen.findByText('Fiel', { exact: true })
  fireEvent.click(screen.getByRole('button', { name: 'Revisar incorporación' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar incorporación' }),
  )
  await screen.findByRole('alert')
  const operation = new Headers(
    fetcher.mock.calls.find(([, init]) => init?.method === 'POST')![1]?.headers,
  ).get('X-LVM-Operation')
  first.unmount()
  render(<WorshipReview {...props} />)
  await screen.findByText('Fiel', { exact: true })
  fireEvent.click(screen.getByRole('button', { name: 'Revisar incorporación' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar incorporación' }),
  )
  await waitFor(() =>
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(2),
  )
  const latest = fetcher.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .at(-1)!
  expect(new Headers(latest[1]?.headers).get('X-LVM-Operation')).toBe(operation)
})
it('hides the previous church immediately and ignores its delayed response', async () => {
  let resolveOld!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (path) =>
      String(path).includes('/church-a/')
        ? new Promise<Response>((resolve) => {
            resolveOld = resolve
          })
        : Response.json({
            ...exchange,
            plan: {
              ...exchange.plan!,
              songs: [{ ...exchange.plan!.songs[0], title: 'Iglesia nueva' }],
            },
          }),
    ),
  )
  const view = render(<WorshipReview {...props} />)
  view.rerender(<WorshipReview {...props} churchId="church-b" />)
  await screen.findByText('Iglesia nueva', { exact: true })
  resolveOld(Response.json(exchange))
  await waitFor(() =>
    expect(screen.queryByText('Fiel', { exact: true })).toBeNull(),
  )
  expect(screen.getByText('Iglesia nueva', { exact: true })).toBeInTheDocument()
})
