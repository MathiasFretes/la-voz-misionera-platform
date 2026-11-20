import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
type SuiteUser = { id: string; email: string; role: string }
const Context = createContext<SuiteUser | null>(null)
export const useSuiteUser = () => useContext(Context)
export function SuiteAuth({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SuiteUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const enabled = import.meta.env.VITE_SERVICE_AUTH === '1'
  useEffect(() => {
    if (!enabled) return
    let active = true
    fetch('/api/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo comprobar la sesión')
        return response.json()
      })
      .then((result) => {
        if (active) setUser(result.session?.user || null)
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [enabled])
  if (!enabled) return <>{children}</>
  if (loading)
    return (
      <main className="page">
        <p role="status">Comprobando tu cuenta…</p>
      </main>
    )
  if (!user)
    return (
      <main className="page">
        <h1>LVM Service</h1>
        <p>
          {error || 'Ingresá con tu cuenta para administrar La Voz Misionera.'}
        </p>
        <a
          className="button primary"
          href={`/login?redirect=${encodeURIComponent(window.location.pathname)}`}
        >
          Ingresar
        </a>
      </main>
    )
  if (!['admin', 'owner'].includes(user.role))
    return (
      <main className="page">
        <h1>LVM Service</h1>
        <p>Tu cuenta no tiene permisos de administración.</p>
        <a className="button secondary" href="/app">
          Volver a Worship
        </a>
      </main>
    )
  return <Context.Provider value={user}>{children}</Context.Provider>
}
