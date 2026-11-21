import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { ServiceRepository } from '../../repositories/ServiceRepository'
import { serviceRepository } from '../../app/dependencies'
import { JournalServiceRepository } from '../../repositories/api/JournalServiceRepository'
import { churchRpc, type Church } from '../auth/churchRepository'
import {
  GlobalAdministration,
  isGlobalAdministrator,
  useSuiteUser,
} from '../auth/SuiteAuth'
import { Button } from '../../ui/Button'

type PlanningState = {
  repository: ServiceRepository | null
  churches: Church[]
  selected: string
  select: (id: string) => Promise<void>
  loading: boolean
  error: string
  canEdit: boolean
  global: boolean
}
const Context = createContext<PlanningState | null>(null)
export const usePlanning = () => useContext(Context)

export function PlanningProvider({ children }: { children: ReactNode }) {
  const user = useSuiteUser()
  if (import.meta.env.VITE_SERVICE_PLANNING !== 'church' || !user)
    return <>{children}</>
  return (
    <ChurchPlanningProvider key={user.id}>{children}</ChurchPlanningProvider>
  )
}
function ChurchPlanningProvider({ children }: { children: ReactNode }) {
  const user = useSuiteUser()!
  const global = isGlobalAdministrator(user)
  const [churches, setChurches] = useState<Church[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clientId] = useState(() => crypto.randomUUID())
  const [slot, setSlot] = useState<{
    key: string
    repository: JournalServiceRepository
  } | null>(null)
  const canEdit =
    global ||
    !!user.memberships
      ?.find((membership) => membership.church_id === selected)
      ?.capabilities.includes('planning:write')
  const scopeKey = `${user.id}:${selected}:${canEdit}`
  const repository =
    selected === 'legacy' && global
      ? serviceRepository
      : slot?.key === scopeKey
        ? slot.repository
        : null
  useEffect(() => {
    let active = true
    churchRpc<Church[]>('list_churches')
      .then((rows) => {
        if (!active) return
        const available = rows.filter((row) => row.status === 'active')
        setChurches(available)
        const previous = localStorage.getItem(
          `lvm.service.selected-church.${user.id}`,
        )
        setSelected(
          previous === 'legacy' && global
            ? 'legacy'
            : available.find((row) => row.id === previous)?.id ||
                (available.length === 1 ? available[0].id : ''),
        )
        setLoading(false)
      })
      .catch((error) => {
        if (active) {
          setError(error.message)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [user.id, global])
  useEffect(() => {
    if (!selected || selected === 'legacy') return
    let active = true
    const next = new JournalServiceRepository(
      user.id,
      selected,
      canEdit,
      clientId,
    )
    void Promise.resolve().then(() => {
      if (active) setSlot({ key: scopeKey, repository: next })
    })
    void next.ready()
    return () => {
      active = false
      void next.dispose()
    }
  }, [user.id, selected, canEdit, clientId, scopeKey])
  async function select(id: string) {
    setError('')
    try {
      if (repository instanceof JournalServiceRepository)
        await repository.waitForLocalWrites()
      localStorage.setItem(`lvm.service.selected-church.${user.id}`, id)
      setSelected(id)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'No se pudo conservar el plan local',
      )
    }
  }
  return (
    <Context.Provider
      key={scopeKey}
      value={{
        repository,
        churches,
        selected,
        select,
        loading,
        error,
        canEdit,
        global,
      }}
    >
      {children}
    </Context.Provider>
  )
}

export function PlanningRoute({
  children,
  editing = false,
}: {
  children: ReactNode
  editing?: boolean
}) {
  const planning = usePlanning()
  if (!planning) return <GlobalAdministration>{children}</GlobalAdministration>
  return (
    <>
      <section
        className="panel form-stack"
        aria-label="Iglesia de planificación"
      >
        <label>
          Iglesia de planificación
          <select
            aria-label="Iglesia de planificación"
            value={planning.selected}
            disabled={planning.loading}
            onChange={(event) => {
              void planning.select(event.target.value)
            }}
          >
            <option value="">Elegí una iglesia</option>
            {planning.churches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.name}
              </option>
            ))}
            {planning.global && (
              <option value="legacy">
                Planes anteriores de este navegador
              </option>
            )}
          </select>
        </label>
        <p>
          {planning.selected === 'legacy'
            ? 'Estos planes siguen en este navegador. No se suben ni se asignan automáticamente a una iglesia.'
            : 'Los borradores y operaciones pendientes se conservan para esta cuenta e iglesia.'}
        </p>
        {planning.error && <p role="alert">{planning.error}</p>}
        {!planning.loading && planning.churches.length === 0 && (
          <p>
            Registrá una iglesia y sus miembros desde Administración para
            comenzar la planificación compartida.
          </p>
        )}
      </section>
      {!planning.selected ? (
        <p role="status">Seleccioná una iglesia para ver sus servicios.</p>
      ) : !planning.repository ? (
        <p role="status">Abriendo los planes de esta iglesia…</p>
      ) : editing && !planning.canEdit ? (
        <section>
          <h1>Planificación de consulta</h1>
          <p>Tu membresía no permite editar los servicios de esta iglesia.</p>
        </section>
      ) : (
        children
      )}
    </>
  )
}

export function PlanningConflicts() {
  const planning = usePlanning()
  const repository = planning?.repository
  const [, setVersion] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(
    () => repository?.subscribe(() => setVersion((version) => version + 1)),
    [repository],
  )
  if (!(repository instanceof JournalServiceRepository)) return null
  const conflicts = repository.syncConflicts()
  if (!conflicts.length) return null
  async function resolve(key: string, choice: 'local' | 'remote') {
    setBusy(true)
    setError('')
    try {
      await (repository as JournalServiceRepository).resolveConflict(
        key,
        choice,
      )
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'No se pudo resolver el conflicto',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section
      className="panel form-stack"
      aria-label="Resolver conflictos de planificación"
    >
      <h2>Cambios en conflicto</h2>
      <p>
        Tu copia se conserva. Elegí explícitamente si querés volver a enviar esa
        versión o usar la del servidor.
      </p>
      {error && <p role="alert">{error}</p>}
      {conflicts.map((conflict) => (
        <article key={conflict.key}>
          <h3>
            {(conflict.record || conflict.deletedRecord)?.service.title ||
              conflict.id}
          </h3>
          <p>
            {conflict.reason === 'local-generation'
              ? 'Otra pestaña cambió este servicio.'
              : 'El servidor tiene otra revisión.'}
          </p>
          <div className="actions">
            <Button
              loading={busy}
              disabled={!planning?.canEdit}
              onClick={() => {
                void resolve(conflict.key, 'local')
              }}
            >
              Conservar mi versión
            </Button>
            <Button
              loading={busy}
              onClick={() => {
                void resolve(conflict.key, 'remote')
              }}
            >
              Usar versión del servidor
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}
