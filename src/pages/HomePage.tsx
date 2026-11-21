import { Link } from '@tanstack/react-router'
import { isGlobalAdministrator, useSuiteUser } from '../features/auth/SuiteAuth'
import { OrganizationPage } from './OrganizationPage'

export function HomePage() {
  const user = useSuiteUser()
  if (!isGlobalAdministrator(user))
    return (
      <section>
        <h1>LVM Service</h1>
        <p>
          Consultá y prepará los servicios de tus iglesias según tu membresía.
        </p>
        <Link className="button primary" to="/services">
          Ver servicios
        </Link>
        {user?.memberships?.some((membership) =>
          membership.capabilities.includes('members:read'),
        ) && <OrganizationPage />}
      </section>
    )
  if (import.meta.env.VITE_SERVICE_AUTH === '1')
    return (
      <section>
        <p className="eyebrow">Administración de la suite</p>
        <h1>LVM Service</h1>
        <p>
          Administrá La Voz Misionera desde un solo lugar: contenido de la web,
          cuentas, solicitudes y preparación de servicios.
        </p>
        <div className="card-grid">
          <article className="card">
            <h2>Web pública</h2>
            <p>
              Guardá borradores y publicá eventos, prédicas, sedes, pastores,
              ministerios y horarios.
            </p>
            <Link className="button primary" to="/content">
              Administrar contenido
            </Link>
          </article>
          <article className="card">
            <h2>Cuentas y solicitudes</h2>
            <p>
              Gestioná roles y consultá los mensajes de contacto, oración,
              visitas y boletín.
            </p>
            <Link className="button secondary" to="/admin">
              Abrir administración
            </Link>
          </article>
          <article className="card">
            <h2>Servicios y presentación</h2>
            <p>
              Prepará el orden del culto en este navegador e intercambiá planes
              con Worship y Presenter mediante los contratos 0.1.
            </p>
            <Link className="button secondary" to="/services">
              Planificar servicios
            </Link>
          </article>
        </div>
        <div className="actions">
          <a className="button secondary" href="/">
            Ver web pública
          </a>
          <a className="button secondary" href="/app">
            Abrir LVM Worship
          </a>
        </div>
      </section>
    )
  return (
    <section className="hero">
      <p className="eyebrow">Planificación del culto</p>
      <h1>Un servicio listo para preparar y presentar.</h1>
      <p>
        Crea el orden del culto, guarda los cambios en este navegador y exporta
        un Service 0.1 que LVM Presenter puede abrir sin conexión.
      </p>
      <div className="actions">
        <Link className="button primary" to="/services/new">
          Crear servicio
        </Link>
        <Link className="button secondary" to="/services">
          Ver servicios
        </Link>
      </div>
    </section>
  )
}
