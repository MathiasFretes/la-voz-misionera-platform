import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { ContentPage } from './ContentPage'
import {
  listSiteDocuments,
  saveSiteDocument,
} from '../features/content/repository'

vi.mock('../features/content/repository', () => ({
  listSiteDocuments: vi.fn(),
  saveSiteDocument: vi.fn(),
}))
afterEach(cleanup)
const document = {
  collection: 'eventos',
  id: 'event',
  draft_data: {
    name: 'Borrador',
    date: '2026-12-01',
    time: '19:00',
    day: 'Central',
  },
  data: { name: 'Publicado' },
  published: true,
  revision: 4,
  updated_at: '2026-11-20T12:00:00Z',
  published_at: '2026-11-20T11:00:00Z',
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listSiteDocuments).mockResolvedValue([document])
})
describe('public content editor', () => {
  it('preserves entered changes after a concurrent-edit conflict', async () => {
    vi.mocked(saveSiteDocument).mockRejectedValue(
      new Error('El contenido cambió en otra sesión'),
    )
    render(<ContentPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: /Borrador.*Publicado/ }),
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre *' }), {
      target: { value: 'Mi corrección' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await screen.findByText('El contenido cambió en otra sesión')
    expect(screen.getByRole('textbox', { name: 'Nombre *' })).toHaveValue(
      'Mi corrección',
    )
    expect(saveSiteDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        p_expected_revision: 4,
        p_action: 'save',
        p_data: expect.objectContaining({ name: 'Mi corrección' }),
      }),
    )
  })
  it('uses an explicit publish operation and adopts the confirmed server revision', async () => {
    vi.mocked(saveSiteDocument).mockResolvedValue({ ...document, revision: 5 })
    render(<ContentPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: /Borrador.*Publicado/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    await waitFor(() =>
      expect(saveSiteDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          p_action: 'publish',
          p_expected_revision: 4,
        }),
      ),
    )
    await screen.findByText(/Revisión 5/)
  })
})
