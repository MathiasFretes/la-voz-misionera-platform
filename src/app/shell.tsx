import { Link, Outlet } from '@tanstack/react-router'

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          LVM <strong>PLATFORM</strong>
        </Link>
        <nav aria-label="Principal">
          <Link to="/" activeProps={{ 'aria-current': 'page' }}>
            Inicio
          </Link>
          <Link to="/services" activeProps={{ 'aria-current': 'page' }}>
            Servicios
          </Link>
          <Link
            to="/development/contract"
            activeProps={{ 'aria-current': 'page' }}
          >
            Contract Inspector
          </Link>
        </nav>
        <span className="offline-badge">Local · Service 0.1</span>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
