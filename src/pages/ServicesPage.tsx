import { Link } from '@tanstack/react-router'
import { useServices } from '../features/services/useServices'

export function ServicesPage() {
  const { records } = useServices()
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LVM Platform</p>
          <h1>Servicios</h1>
          <p>El orden del culto vive en este navegador.</p>
        </div>
        <Link className="button primary" to="/services/new">
          + Nuevo servicio
        </Link>
      </div>
      {records.length ? (
        <div className="card-grid">
          {records.map(({ id, venue, service }) => (
            <article className="service-card" key={id}>
              <div>
                <h2>{service.title || 'Sin título'}</h2>
                <p>
                  {new Intl.DateTimeFormat('es-PY', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  }).format(new Date(service.startsAt))}
                </p>
                <p>{venue || 'Sin sede'}</p>
              </div>
              <div className="card-footer">
                <span>{service.items.length} elementos</span>
                <Link
                  className="button secondary"
                  to="/services/$serviceId"
                  params={{ serviceId: id }}
                >
                  Abrir servicio
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Todavía no hay servicios</h2>
          <p>Empieza con un culto nuevo y agrega su orden.</p>
          <Link className="button primary" to="/services/new">
            Crear el primero
          </Link>
        </div>
      )}
    </>
  )
}
