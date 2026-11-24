import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { ChurchAdministration } from './ChurchAdministration'
import { churchRpc } from './churchRepository'

vi.mock('./churchRepository', () => ({ churchRpc: vi.fn() }))
afterEach(cleanup)
const church = {
  id: 'church-a',
  name: 'Central',
  status: 'active',
  revision: 3,
}
const member = {
  user_id: 'user-a',
  display_name: 'Ana',
  role: 'member',
  status: 'active',
  revision: 7,
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(churchRpc).mockImplementation(async (name) => {
    if (name === 'list_churches') return [church] as never
    if (name === 'list_church_memberships') return [member] as never
    throw new Error('Cambió en otra sesión')
  })
})
it('limits a church leader to the roster without global account or membership editing', async () => {
  render(
    <ChurchAdministration
      users={[]}
      global={false}
      memberships={[
        {
          church_id: church.id,
          church_name: church.name,
          church_status: 'active',
          role: 'leader',
          status: 'active',
          capabilities: ['members:read'],
        },
      ]}
    />,
  )
  await screen.findByRole('button', { name: /Ana.*Miembro/ })
  expect(
    screen.queryByRole('textbox', { name: 'Nombre de la iglesia' }),
  ).toBeNull()
  expect(screen.queryByRole('button', { name: 'Guardar membresía' })).toBeNull()
  expect(screen.queryByRole('option', { name: 'Nueva iglesia' })).toBeNull()
  expect(
    vi
      .mocked(churchRpc)
      .mock.calls.every(([name]) =>
        ['list_churches', 'list_church_memberships'].includes(name),
      ),
  ).toBe(true)
})
async function open() {
  render(
    <ChurchAdministration users={[{ id: 'user-a', display_name: 'Ana' }]} />,
  )
  await screen.findByRole('option', { name: 'Central · Activa' })
  fireEvent.change(screen.getByRole('combobox', { name: 'Iglesia' }), {
    target: { value: church.id },
  })
  await screen.findByRole('button', { name: /Ana.*Miembro/ })
}
it('preserves a conflicting church edit and prevents switching before discard', async () => {
  await open()
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Nombre de la iglesia' }),
    { target: { value: 'Central editada' } },
  )
  expect(screen.getByRole('combobox', { name: 'Iglesia' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar iglesia' }))
  await screen.findByRole('alert')
  expect(
    screen.getByRole('textbox', { name: 'Nombre de la iglesia' }),
  ).toHaveValue('Central editada')
  expect(churchRpc).toHaveBeenCalledWith(
    'save_church',
    expect.objectContaining({ p_id: church.id, p_expected_revision: 3 }),
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Descartar cambios de iglesia' }),
  )
  expect(
    screen.getByRole('textbox', { name: 'Nombre de la iglesia' }),
  ).toHaveValue('Central')
  expect(screen.getByRole('combobox', { name: 'Iglesia' })).toBeEnabled()
})
it('sends membership revision, preserves a failed role change and supports explicit reload', async () => {
  await open()
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Cuenta de la membresía' }),
    { target: { value: 'user-a' } },
  )
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Rol en la iglesia' }),
    { target: { value: 'leader' } },
  )
  fireEvent.click(screen.getByRole('button', { name: 'Guardar membresía' }))
  await screen.findByRole('alert')
  expect(churchRpc).toHaveBeenCalledWith('save_church_membership', {
    p_church_id: church.id,
    p_user_id: 'user-a',
    p_role: 'leader',
    p_status: 'active',
    p_expected_revision: 7,
  })
  expect(
    screen.getByRole('combobox', { name: 'Rol en la iglesia' }),
  ).toHaveValue('leader')
  expect(screen.getByRole('combobox', { name: 'Iglesia' })).toBeDisabled()
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Descartar cambios y recargar membresías',
    }),
  )
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: 'Cuenta de la membresía' }),
    ).toBeEnabled(),
  )
  expect(screen.getByRole('combobox', { name: 'Iglesia' })).toBeEnabled()
})
it('uses the confirmed membership revision on the next save', async () => {
  vi.mocked(churchRpc).mockImplementation(async (name, input) => {
    if (name === 'list_churches') return [church] as never
    if (name === 'list_church_memberships') return [member] as never
    const data = input as { p_expected_revision: number; p_role: string }
    return [
      { ...member, role: data.p_role, revision: data.p_expected_revision + 1 },
    ] as never
  })
  await open()
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Cuenta de la membresía' }),
    { target: { value: 'user-a' } },
  )
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Rol en la iglesia' }),
    { target: { value: 'leader' } },
  )
  fireEvent.click(screen.getByRole('button', { name: 'Guardar membresía' }))
  await screen.findByText(/Membresía guardada/)
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Rol en la iglesia' }),
    { target: { value: 'viewer' } },
  )
  fireEvent.click(screen.getByRole('button', { name: 'Guardar membresía' }))
  await waitFor(() =>
    expect(churchRpc).toHaveBeenCalledWith(
      'save_church_membership',
      expect.objectContaining({ p_expected_revision: 8, p_role: 'viewer' }),
    ),
  )
})
