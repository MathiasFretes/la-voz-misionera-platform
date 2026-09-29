import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { Button } from '../ui/Button'

function Navigation({ close }: { close?: () => void }) {
  return (
    <nav aria-label="Secciones">
      <Link to="/" activeOptions={{ exact: true }} onClick={close}>
        Inicio
      </Link>
      <Link to="/services" onClick={close}>
        Servicios
      </Link>
      <Link to="/development/contract" onClick={close}>
        Contract Inspector
      </Link>
    </nav>
  )
}

function Brand({ close }: { close?: () => void }) {
  return (
    <Link to="/" className="brand" onClick={close}>
      <span className="brand-mark" aria-hidden="true">
        LV
      </span>
      <span>
        <strong>La Voz Misionera</strong>
        <small>Platform</small>
      </span>
    </Link>
  )
}

function LocalStatus() {
  return (
    <div className="local-status">
      <span className="local-status-dot" aria-hidden="true" />
      <span>Flujo local · disponible sin conexión</span>
    </div>
  )
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const menuDrawer = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const section = pathname.startsWith('/services')
    ? 'Servicios'
    : pathname.startsWith('/development')
      ? 'Desarrollo'
      : 'Inicio'

  useEffect(() => {
    if (menuOpen) menuDrawer.current?.querySelector('a')?.focus()
  }, [menuOpen])

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 850px)')
    const closeOnDesktop = () => {
      if (!mobile.matches) setMenuOpen(false)
    }
    mobile.addEventListener('change', closeOnDesktop)
    return () => mobile.removeEventListener('change', closeOnDesktop)
  }, [])

  function closeMenu() {
    setMenuOpen(false)
    menuTrigger.current?.focus()
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Navegación principal">
        <Brand />
        <Navigation />
        <div className="sidebar-footer">
          <LocalStatus />
          <small>Service 0.1</small>
        </div>
      </aside>
      <div className="app-main">
        <header className="mobile-header">
          <Button
            ref={menuTrigger}
            variant="quiet"
            className="menu-trigger"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">☰</span>
          </Button>
          <span className="mobile-section">{section}</span>
        </header>
        {menuOpen && (
          <>
            <button
              type="button"
              className="mobile-backdrop"
              aria-label="Cerrar menú"
              onClick={closeMenu}
            />
            <div
              ref={menuDrawer}
              className="mobile-drawer"
              id="mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Menú principal"
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeMenu()
                if (event.key !== 'Tab') return
                const links = menuDrawer.current?.querySelectorAll('a')
                if (!links?.length) return
                const first = links[0]
                const last = links[links.length - 1]
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault()
                  last.focus()
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault()
                  first.focus()
                }
              }}
            >
              <Brand close={closeMenu} />
              <Navigation close={closeMenu} />
              <div className="sidebar-footer">
                <LocalStatus />
                <small>Service 0.1</small>
              </div>
            </div>
          </>
        )}
        <main className="page" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
