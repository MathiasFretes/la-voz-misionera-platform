import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { useSuiteUser } from '../features/auth/SuiteAuth'
import { ChurchAdministration } from '../features/auth/ChurchAdministration'
type Profile = { id: string; display_name: string; email: string; role: string }
type Inbox = {
  id: string
  kind: string
  payload: Record<string, string>
  created_at: string
}
async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`/api/data/${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    method: data === undefined ? 'GET' : 'POST',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  if (!response.ok) {
    const result = await response.json()
    throw new Error(result.message || 'No se pudo completar la operación')
  }
  return response.status === 204 ? (undefined as T) : response.json()
}
export function AdministrationPage() {
  const current = useSuiteUser()
  const [users, setUsers] = useState<Profile[]>([])
  const [inbox, setInbox] = useState<Inbox[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  async function load() {
    setBusy(true)
    setError('')
    try {
      const [profiles, messages] = await Promise.all([
        api<Profile[]>('rpc/list_suite_accounts', {}),
        api<Inbox[]>('rpc/list_site_inbox', {}),
      ])
      setUsers(profiles)
      setInbox(messages)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar la administración',
      )
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    let active = true
    Promise.all([
      api<Profile[]>('rpc/list_suite_accounts', {}),
      api<Inbox[]>('rpc/list_site_inbox', {}),
    ])
      .then(([profiles, messages]) => {
        if (active) {
          setUsers(profiles)
          setInbox(messages)
        }
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => {
      active = false
    }
  }, [])
  async function changeRole(id: string, role: string) {
    setBusy(true)
    setError('')
    try {
      await api('rpc/update_user_role', { target_user_id: id, new_role: role })
      await load()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'No se pudo actualizar el rol',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section>
      <p className="eyebrow">Administración de la suite</p>
      <h1>LVM Service</h1>
      <p>
        Gestioná las cuentas y las solicitudes recibidas desde la web pública.
      </p>
      <div className="actions">
        <Button onClick={load} loading={busy}>
          Actualizar
        </Button>
        <a className="button secondary" href="/">
          Ver web pública
        </a>
        <a className="button secondary" href="/app">
          Abrir Worship
        </a>
      </div>
      {error && <p role="alert">{error}</p>}
      <ChurchAdministration users={users} />
      <section className="card">
        <h2>Usuarios y roles</h2>
        {users.map((user) => (
          <article className="card" key={user.id}>
            <h3>{user.display_name || 'Sin nombre'}</h3>
            <p style={{ overflowWrap: 'anywhere' }}>{user.email}</p>
            <label>
              Rol
              <select
                aria-label={`Rol de ${user.display_name || user.id}`}
                value={user.role}
                disabled={
                  busy ||
                  user.id === current?.id ||
                  user.role === 'owner' ||
                  (user.role === 'admin' && current?.role !== 'owner')
                }
                onChange={(event) => changeRole(user.id, event.target.value)}
              >
                {[
                  'user',
                  'editor',
                  ...(current?.role === 'owner' || user.role === 'admin'
                    ? ['admin']
                    : []),
                  ...(user.role === 'owner' ? ['owner'] : []),
                ].map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </section>
      <section className="card">
        <h2>Solicitudes de la web</h2>
        {!busy && inbox.length === 0 && (
          <p>Todavía no hay solicitudes recibidas.</p>
        )}
        {inbox.map((row) => (
          <article className="card" key={row.id}>
            <h3>{row.kind}</h3>
            <p>{new Date(row.created_at).toLocaleString()}</p>
            <dl>
              {Object.entries(row.payload).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd
                    style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </section>
    </section>
  )
}
