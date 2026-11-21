import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PlanningProvider, usePlanning } from './PlanningContext'

const mocks = vi.hoisted(() => ({
  churches: vi.fn(),
  repository: vi.fn(),
  user: { id: 'account', role: 'admin', memberships: [] },
}))
vi.mock('../auth/SuiteAuth', () => ({
  useSuiteUser: () => mocks.user,
  isGlobalAdministrator: () => true,
  GlobalAdministration: ({ children }: { children: React.ReactNode }) =>
    children,
}))
vi.mock('../auth/churchRepository', () => ({ churchRpc: mocks.churches }))
vi.mock('../../app/dependencies', () => ({ serviceRepository: {} }))
vi.mock('../../repositories/api/JournalServiceRepository', () => ({
  JournalServiceRepository: class {
    constructor(...args: unknown[]) {
      mocks.repository(...args)
    }
    ready = async () => {}
    dispose = async () => {}
  },
}))
function Probe() {
  const state = usePlanning()
  return (
    <>
      <p data-testid="selection">{state?.selected}</p>
      <p>{state?.error}</p>
    </>
  )
}
beforeEach(() => {
  vi.stubEnv('VITE_SERVICE_PLANNING', 'church')
  vi.clearAllMocks()
  localStorage.clear()
  mocks.churches.mockResolvedValue([
    { id: 'church-a', status: 'active' },
    { id: 'church-b', status: 'active' },
    { id: 'suspended', status: 'suspended' },
  ])
  localStorage.setItem('lvm.service.selected-church.account', 'church-a')
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  window.history.replaceState(null, '', '/')
  localStorage.clear()
})
it('opens the authorized church from Worship instead of the previously selected church', async () => {
  window.history.replaceState(
    null,
    '',
    '/service/services/plan?churchId=church-b',
  )
  render(
    <PlanningProvider>
      <Probe />
    </PlanningProvider>,
  )
  await waitFor(() =>
    expect(screen.getByTestId('selection')).toHaveTextContent('church-b'),
  )
  expect(localStorage.getItem('lvm.service.selected-church.account')).toBe(
    'church-b',
  )
  await waitFor(() => expect(mocks.repository).toHaveBeenCalled())
  expect(
    mocks.repository.mock.calls.every(([, church]) => church === 'church-b'),
  ).toBe(true)
})
it.each(['foreign', 'suspended', 'legacy', ''])(
  'does not fall back to another tenant for the unavailable link %s',
  async (church) => {
    window.history.replaceState(
      null,
      '',
      `/service/services/plan?churchId=${church}`,
    )
    render(
      <PlanningProvider>
        <Probe />
      </PlanningProvider>,
    )
    await screen.findByText(
      'La iglesia del enlace no está disponible para tu cuenta.',
    )
    expect(screen.getByTestId('selection')).toBeEmptyDOMElement()
    expect(mocks.repository).not.toHaveBeenCalled()
  },
)
it('keeps the account-scoped selection for ordinary Service navigation', async () => {
  window.history.replaceState(null, '', '/service/services')
  render(
    <PlanningProvider>
      <Probe />
    </PlanningProvider>,
  )
  await waitFor(() =>
    expect(screen.getByTestId('selection')).toHaveTextContent('church-a'),
  )
})
