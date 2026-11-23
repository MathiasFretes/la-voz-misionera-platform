import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GlobalAdministration, SuiteAuth } from './SuiteAuth'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
function session(role: string, capabilities: string[] = []) {
  vi.stubEnv('VITE_SERVICE_AUTH', '1')
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        session: {
          user: { id: 'user', role, memberships: [{ capabilities }] },
        },
      }),
    }),
  )
}
it('admits a church administrator while protecting global administration', async () => {
  session('user', ['members:read', 'members:manage'])
  render(
    <SuiteAuth>
      <p>Iglesia disponible</p>
      <GlobalAdministration>
        <p>Datos globales</p>
      </GlobalAdministration>
    </SuiteAuth>,
  )
  await screen.findByText('Iglesia disponible')
  expect(screen.queryByText('Datos globales')).toBeNull()
  expect(
    screen.getByText('Tu rol de iglesia no autoriza esta sección.'),
  ).toBeInTheDocument()
})
it('rejects a suspended membership with no effective capabilities', async () => {
  session('user', [])
  render(
    <SuiteAuth>
      <p>Datos privados</p>
    </SuiteAuth>,
  )
  await screen.findByText('Tu cuenta no tiene permisos de administración.')
  expect(screen.queryByText('Datos privados')).toBeNull()
})
it('admits a music editor without granting global administration', async () => {
  session('editor', [])
  render(
    <SuiteAuth>
      <p>Revisión musical disponible</p>
      <GlobalAdministration>
        <p>Cuentas globales</p>
      </GlobalAdministration>
    </SuiteAuth>,
  )
  await screen.findByText('Revisión musical disponible')
  expect(screen.queryByText('Cuentas globales')).toBeNull()
  expect(
    screen.getByText('Tu rol de iglesia no autoriza esta sección.'),
  ).toBeInTheDocument()
})
it('preserves global administration for the suite owner', async () => {
  session('owner')
  render(
    <SuiteAuth>
      <GlobalAdministration>
        <p>Datos globales</p>
      </GlobalAdministration>
    </SuiteAuth>,
  )
  await screen.findByText('Datos globales')
})
it('admits a planning viewer only when church planning is enabled and still denies global administration', async () => {
  session('user', ['planning:read'])
  vi.stubEnv('VITE_SERVICE_PLANNING', 'church')
  render(
    <SuiteAuth>
      <p>Planificación de consulta</p>
      <GlobalAdministration>
        <p>Datos globales</p>
      </GlobalAdministration>
    </SuiteAuth>,
  )
  await screen.findByText('Planificación de consulta')
  expect(screen.queryByText('Datos globales')).toBeNull()
})
