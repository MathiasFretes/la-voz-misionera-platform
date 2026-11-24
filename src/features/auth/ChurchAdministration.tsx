import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../ui/Button'
import { churchRpc, type Church, type ChurchMember } from './churchRepository'

type Profile = { id: string; display_name: string; email?: string }
const roles = {
  admin: 'Administrador de iglesia',
  leader: 'Responsable',
  member: 'Miembro',
  viewer: 'Consulta',
}
const statusName = { active: 'Activa', suspended: 'Suspendida' }

export function ChurchAdministration({
  users,
  global = true,
  memberships = [],
}: {
  users: Profile[]
  global?: boolean
  memberships?: import('./SuiteAuth').ChurchMembership[]
}) {
  const [churches, setChurches] = useState<Church[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const [churchLocked, setChurchLocked] = useState(false)
  const [membersLocked, setMembersLocked] = useState(false)
  const locked = churchLocked || membersLocked
  useEffect(() => {
    if (!locked) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [locked])
  useEffect(() => {
    let active = true
    churchRpc<Church[]>('list_churches')
      .then((rows) => {
        if (active) {
          setChurches(rows)
          if (!global)
            setSelected((current) =>
              rows.some((row) => row.id === current)
                ? current
                : rows[0]?.id || '',
            )
          setLoading(false)
        }
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
  }, [version, global])
  const church = churches.find((row) => row.id === selected)
  const ownMembership = memberships.find((row) => row.church_id === selected)
  return (
    <section
      className="card form-stack church-administration"
      aria-label="Organización por iglesia"
    >
      <h2>Iglesias y membresías</h2>
      <p>
        Los roles de iglesia se aplican únicamente a esa organización. No
        otorgan administración global de la suite.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <Button
          onClick={() => {
            setLoading(true)
            setError('')
            setVersion((v) => v + 1)
          }}
          loading={loading}
          disabled={locked}
        >
          Actualizar iglesias
        </Button>
      </div>
      {loading ? (
        <p role="status">Cargando iglesias…</p>
      ) : (
        <>
          {churches.length === 0 && !error && (
            <p>
              {global
                ? 'Todavía no hay iglesias registradas. Creá una y asigná sus miembros.'
                : 'No tenés iglesias activas asignadas.'}
            </p>
          )}
          <label>
            Iglesia
            <select
              aria-label="Iglesia"
              value={selected}
              disabled={locked}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">
                {global ? 'Nueva iglesia' : 'Elegí una iglesia'}
              </option>
              {churches.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {statusName[row.status]}
                </option>
              ))}
            </select>
          </label>
          {global && (
            <ChurchEditor
              key={`church:${selected}:${church?.revision || 0}`}
              church={church}
              disabled={membersLocked}
              onLock={setChurchLocked}
              onSaved={(saved) => {
                setChurches((rows) => [
                  ...rows.filter((row) => row.id !== saved.id),
                  saved,
                ])
                setSelected(saved.id)
                setNotice('Iglesia guardada.')
                setChurchLocked(false)
              }}
            />
          )}
          {notice && <p role="status">{notice}</p>}
          {church && (
            <MembershipEditor
              key={`members:${church.id}:${church.revision}`}
              church={church}
              users={users}
              disabled={churchLocked}
              onLock={setMembersLocked}
              global={global}
              canManage={
                global ||
                !!ownMembership?.capabilities.includes('members:manage')
              }
            />
          )}
        </>
      )}
    </section>
  )
}

function ChurchEditor({
  church,
  onSaved,
  disabled,
  onLock,
}: {
  church?: Church
  onSaved: (church: Church) => void
  disabled: boolean
  onLock: (locked: boolean) => void
}) {
  const [name, setName] = useState(church?.name || '')
  const [status, setStatus] = useState(church?.status || 'active')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    onLock(true)
    setError('')
    setMessage('')
    try {
      const [saved] = await churchRpc<Church[]>('save_church', {
        p_id: church?.id || crypto.randomUUID(),
        p_name: name,
        p_status: status,
        p_expected_revision: church?.revision || 0,
      })
      if (!saved) throw new Error('El servidor no confirmó la iglesia')
      onSaved(saved)
      setMessage('Iglesia guardada.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="card" onSubmit={save}>
      <h3>{church ? 'Editar iglesia' : 'Crear iglesia'}</h3>
      <fieldset className="content-fields" disabled={busy || disabled}>
        <label>
          Nombre de la iglesia
          <input
            aria-label="Nombre de la iglesia"
            required
            maxLength={160}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              onLock(true)
            }}
          />
        </label>
        <label>
          Estado de la iglesia
          <select
            aria-label="Estado de la iglesia"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as Church['status'])
              onLock(true)
            }}
          >
            <option value="active">Activa</option>
            <option value="suspended">Suspendida</option>
          </select>
        </label>
        <p>
          Suspender una iglesia desactiva las capacidades de todas sus
          membresías. Los datos se conservan.
        </p>
        <div className="actions">
          <Button type="submit" variant="primary" loading={busy}>
            Guardar iglesia
          </Button>
          <Button
            onClick={() => {
              setName(church?.name || '')
              setStatus(church?.status || 'active')
              setError('')
              setMessage('')
              onLock(false)
            }}
          >
            Descartar cambios de iglesia
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert">{error} Tus cambios siguen en el formulario.</p>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  )
}

function MembershipEditor({
  church,
  users,
  disabled,
  onLock,
  global,
  canManage,
}: {
  church: Church
  users: Profile[]
  disabled: boolean
  onLock: (locked: boolean) => void
  global: boolean
  canManage: boolean
}) {
  const [members, setMembers] = useState<ChurchMember[]>([])
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<ChurchMember['role']>('member')
  const [status, setStatus] = useState<ChurchMember['status']>('active')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    let active = true
    churchRpc<ChurchMember[]>('list_church_memberships', {
      p_church_id: church.id,
    })
      .then((rows) => {
        if (active) {
          setMembers(rows)
          setBusy(false)
        }
      })
      .catch((error) => {
        if (active) {
          setError(error.message)
          setBusy(false)
        }
      })
    return () => {
      active = false
    }
  }, [church.id, refresh])
  const member = members.find((row) => row.user_id === userId)
  const accounts: Profile[] = global
    ? users
    : members.map((row) => ({
        id: row.user_id,
        display_name: row.display_name,
      }))
  const protectedAdmin = !global && member?.role === 'admin'
  function choose(id: string) {
    const row = members.find((member) => member.user_id === id)
    setUserId(id)
    setRole(row?.role || 'member')
    setStatus(row?.status || 'active')
    setError('')
    setMessage('')
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    onLock(true)
    setError('')
    setMessage('')
    try {
      const [saved] = await churchRpc<ChurchMember[]>(
        'save_church_membership',
        {
          p_church_id: church.id,
          p_user_id: userId,
          p_role: role,
          p_status: status,
          p_expected_revision: member?.revision || 0,
        },
      )
      if (!saved) throw new Error('El servidor no confirmó la membresía')
      setMembers((rows) => [
        ...rows.filter((row) => row.user_id !== userId),
        {
          ...saved,
          display_name:
            accounts.find((user) => user.id === userId)?.display_name || '',
        },
      ])
      setMessage(
        'Membresía guardada. Los permisos se vuelven a comprobar en cada consulta.',
      )
      setDirty(false)
      onLock(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card" aria-label="Membresías de la iglesia">
      <h3>Miembros de {church.name}</h3>
      <ul className="content-list">
        {members.map((row) => (
          <li key={row.user_id}>
            <button
              type="button"
              disabled={busy || disabled || dirty}
              aria-pressed={userId === row.user_id}
              onClick={() => choose(row.user_id)}
            >
              {row.display_name || 'Cuenta sin nombre'}
              <span>
                {roles[row.role]} · {statusName[row.status]}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!busy && !members.length && !error && (
        <p>Esta iglesia todavía no tiene miembros asignados.</p>
      )}
      {!global && (
        <p>
          Las cuentas nuevas se asignan desde la administración global.{' '}
          {canManage
            ? 'Podés actualizar las membresías existentes de tu iglesia.'
            : 'Tu rol permite consultar las membresías.'}
        </p>
      )}
      {canManage && (
        <form onSubmit={save}>
          <fieldset className="content-fields" disabled={busy || disabled}>
            <label>
              Cuenta
              <select
                aria-label="Cuenta de la membresía"
                required
                disabled={dirty}
                value={userId}
                onChange={(event) => choose(event.target.value)}
              >
                <option value="">Elegí una cuenta existente</option>
                {accounts.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name || 'Sin nombre'} ·{' '}
                    {user.email || user.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rol en la iglesia
              <select
                aria-label="Rol en la iglesia"
                value={role}
                disabled={protectedAdmin}
                onChange={(event) => {
                  setRole(event.target.value as ChurchMember['role'])
                  setDirty(true)
                  onLock(true)
                }}
              >
                {Object.entries(roles)
                  .filter(
                    ([value]) =>
                      global || value !== 'admin' || member?.role === 'admin',
                  )
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Estado de la membresía
              <select
                aria-label="Estado de la membresía"
                value={status}
                disabled={protectedAdmin}
                onChange={(event) => {
                  setStatus(event.target.value as ChurchMember['status'])
                  setDirty(true)
                  onLock(true)
                }}
              >
                <option value="active">Activa</option>
                <option value="suspended">Suspendida</option>
              </select>
            </label>
            <p>
              Administrador: gestiona miembros. Responsable: consulta miembros y
              prepara cultos. Miembro: preparación musical. Consulta: lectura.
              La planificación conectada se incorporará en la siguiente etapa.
            </p>
            <div className="actions">
              <Button
                type="submit"
                variant="primary"
                loading={busy}
                disabled={!userId || protectedAdmin}
              >
                Guardar membresía
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  setError('')
                  setMessage('')
                  setUserId('')
                  setRole('member')
                  setStatus('active')
                  setRefresh((v) => v + 1)
                  setDirty(false)
                  onLock(false)
                }}
              >
                Descartar cambios y recargar membresías
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {error && (
        <p role="alert">
          {error} Tus cambios siguen en el formulario. Si hubo un conflicto,
          copiá los cambios antes de recargar.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
