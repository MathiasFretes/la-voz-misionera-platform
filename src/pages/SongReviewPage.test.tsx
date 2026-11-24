import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SongReviewPage } from './SongReviewPage'
import {
  listSongProposals,
  reviewSongProposal,
  getReviewSong,
  rebaseSongProposal,
} from '../features/content/songReviewRepository'

const state = vi.hoisted(() => ({ role: 'editor' }))
vi.mock('../features/auth/SuiteAuth', () => ({
  useSuiteUser: () => ({ id: 'reviewer', role: state.role }),
  canReviewSongs: (user: { role: string } | null) =>
    !!user && ['editor', 'admin', 'owner'].includes(user.role),
}))
vi.mock('../features/content/songReviewRepository', () => ({
  listSongProposals: vi.fn(),
  reviewSongProposal: vi.fn(),
  getReviewSong: vi.fn(),
  rebaseSongProposal: vi.fn(),
}))
const proposal = {
  id: 'proposal-1',
  song_id: null,
  type: 'addition' as const,
  payload: {
    title: 'Canción de QA',
    default_key: 'G',
    tags: ['QA'],
    chordpro_content: '[G]Prueba original',
  },
  created_at: '2026-11-23T10:00:00Z',
}
beforeEach(() => {
  state.role = 'editor'
  vi.mocked(listSongProposals).mockReset().mockResolvedValue([proposal])
  vi.mocked(reviewSongProposal)
    .mockReset()
    .mockResolvedValue({ status: 'approved', song_id: 'song-1' })
})
afterEach(cleanup)

it('requires an explicit confirmation before publishing a new proposal', async () => {
  render(<SongReviewPage />)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Revisar Canción de QA' }),
  )
  expect(
    screen.getByRole('region', { name: 'Detalle de la propuesta' }),
  ).toHaveFocus()
  expect(screen.getByText('[G]Prueba original')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Aprobar propuesta' }))
  expect(reviewSongProposal).not.toHaveBeenCalled()
  vi.mocked(listSongProposals).mockResolvedValue([])
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprobación' }))
  await screen.findByText('Propuesta aprobada y guardada.')
  expect(reviewSongProposal).toHaveBeenCalledWith('proposal-1', 'approve', '')
  expect(
    await screen.findByText('No hay propuestas pendientes.'),
  ).toBeInTheDocument()
})

it('retains the decision and reason for an explicit retry after a review failure', async () => {
  vi.mocked(reviewSongProposal).mockRejectedValueOnce(
    new Error('Respuesta perdida'),
  )
  render(<SongReviewPage />)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Revisar Canción de QA' }),
  )
  fireEvent.change(screen.getByLabelText('Motivo del rechazo (opcional)'), {
    target: { value: 'Revisar el arreglo' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Rechazar propuesta' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar rechazo' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Respuesta perdida',
  )
  expect(screen.getByLabelText('Motivo del rechazo (opcional)')).toHaveValue(
    'Revisar el arreglo',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar rechazo' }))
  await waitFor(() => expect(reviewSongProposal).toHaveBeenCalledTimes(2))
  expect(vi.mocked(reviewSongProposal).mock.calls).toEqual([
    ['proposal-1', 'reject', 'Revisar el arreglo'],
    ['proposal-1', 'reject', 'Revisar el arreglo'],
  ])
})

it('does not fetch the review queue for an ordinary church user', () => {
  state.role = 'user'
  render(<SongReviewPage />)
  expect(
    screen.getByText('Necesitás un rol de editor para revisar propuestas.'),
  ).toBeInTheDocument()
  expect(listSongProposals).not.toHaveBeenCalled()
})

it('keeps deletion approval restricted to administrators', async () => {
  vi.mocked(listSongProposals).mockResolvedValue([
    { ...proposal, type: 'deletion' },
  ])
  render(<SongReviewPage />)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Revisar Canción de QA' }),
  )
  expect(screen.queryByRole('button', { name: 'Aprobar propuesta' })).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Rechazar propuesta' }),
  ).toBeInTheDocument()
})

it('blocks approval of a stale proposal until comparison and a separately confirmed rebase', async () => {
  const stale = {
    ...proposal,
    type: 'edit' as const,
    song_id: 'song-1',
    base_song_updated_at: 'old-version',
  }
  vi.mocked(listSongProposals).mockResolvedValue([stale])
  vi.mocked(getReviewSong).mockResolvedValue({
    slug: 'song',
    title: 'Publicado',
    chordpro_content: '[D]Cambio posterior',
    updated_at: 'current-version',
  })
  vi.mocked(rebaseSongProposal).mockResolvedValue({
    ...stale,
    base_song_updated_at: 'current-version',
  })
  render(<SongReviewPage />)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Revisar Canción de QA' }),
  )
  await screen.findByRole('region', { name: 'Propuesta desactualizada' })
  expect(
    screen.getByRole('button', { name: 'Aprobar propuesta' }),
  ).toBeDisabled()
  expect(screen.getByText('[D]Cambio posterior')).toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Comparé las versiones; actualizar base',
    }),
  )
  expect(rebaseSongProposal).not.toHaveBeenCalled()
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar actualización de base' }),
  )
  await screen.findByText(
    'Base actualizada tras la comparación. La propuesta todavía no está aprobada.',
  )
  expect(rebaseSongProposal).toHaveBeenCalledWith(
    'proposal-1',
    'current-version',
  )
  expect(reviewSongProposal).not.toHaveBeenCalled()
  expect(
    screen.getByRole('button', { name: 'Aprobar propuesta' }),
  ).toBeEnabled()
})
