import { Link } from '@tanstack/react-router'
import type { ServiceRecord } from '../domain/service/service'
import {
  dashboardStatus,
  selectDashboardServices,
} from '../features/services/dashboardSelectors'
import { useServices } from '../features/services/useServices'
import { Card } from '../ui/Card'
import { PageHeader } from '../ui/PageHeader'
import { StatusBadge } from '../ui/Badge'
import { buttonClass } from '../ui/Button'

function serviceMeta(record: ServiceRecord): string {
  const date = new Date(record.service.startsAt)
  const venue = record.venue.trim() || 'Sin sede'
  if (Number.isNaN(date.getTime())) return `Fecha por definir · ${venue}`
  const day = new Intl.DateTimeFormat('es-PY', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(date)
  const time = new Intl.DateTimeFormat('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time} · ${venue}`
}

function ServiceStatuses({ record }: { record: ServiceRecord }) {
  const status = dashboardStatus(record)
  return (
    <div
      className="dashboard-statuses"
      aria-label={`Estados de ${record.service.title || 'servicio sin título'}`}
    >
      <StatusBadge
        dimension="Persistencia"
        value="Guardado local"
        tone="success"
      />
      <StatusBadge
        dimension="Worship"
        value={
          status.worship === 'imported'
            ? 'Repertorio importado'
            : 'Sin repertorio'
        }
        tone={status.worship === 'imported' ? 'neutral' : 'warning'}
      />
      <StatusBadge
        dimension="Presenter"
        value={status.presenter === 'valid' ? 'Service válido' : 'Inválido'}
        tone={status.presenter === 'valid' ? 'success' : 'danger'}
      />
    </div>
  )
}

export function ServicesPage() {
  const { records } = useServices()
  const { upcoming, recent } = selectDashboardServices(records, new Date())

  return (
    <>
      <PageHeader
        title="Servicios"
        eyebrow="LVM Platform"
        description="El orden del culto vive en este navegador."
        actions={
          <Link className={buttonClass('primary')} to="/services/new">
            + Crear servicio
          </Link>
        }
      />

      {records.length === 0 ? (
        <Card
          as="section"
          className="dashboard-empty"
          aria-labelledby="dashboard-empty-title"
        >
          <h2 id="dashboard-empty-title">Organizá tu primer servicio</h2>
          <p>Prepará el orden del culto y guardalo en este navegador.</p>
          <Link className={buttonClass('primary')} to="/services/new">
            Crear servicio
          </Link>
        </Card>
      ) : (
        <div className="dashboard-content">
          {upcoming && (
            <Card
              as="section"
              className="dashboard-hero"
              aria-labelledby="dashboard-next-title"
            >
              <div>
                <p className="dashboard-kicker">Próximo servicio</p>
                <h2 id="dashboard-next-title">
                  {upcoming.service.title || 'Sin título'}
                </h2>
                <p className="dashboard-meta">{serviceMeta(upcoming)}</p>
                <ServiceStatuses record={upcoming} />
              </div>
              <Link
                className={buttonClass('primary', 'dashboard-hero-action')}
                to="/services/$serviceId"
                params={{ serviceId: upcoming.id }}
              >
                Abrir servicio <span aria-hidden="true">→</span>
              </Link>
            </Card>
          )}

          <section aria-labelledby="dashboard-recent-title">
            <div className="dashboard-collection-heading">
              <div>
                <p className="dashboard-kicker">Colección local</p>
                <h2 id="dashboard-recent-title">Servicios recientes</h2>
              </div>
              <span>
                {recent.length} {recent.length === 1 ? 'servicio' : 'servicios'}
              </span>
            </div>
            <div className="dashboard-grid">
              {recent.map((record) => (
                <Card
                  as="article"
                  className="dashboard-service-card"
                  key={record.id}
                >
                  <div>
                    <h3>{record.service.title || 'Sin título'}</h3>
                    <p className="dashboard-meta">{serviceMeta(record)}</p>
                  </div>
                  <ServiceStatuses record={record} />
                  <Link
                    className={buttonClass('secondary')}
                    to="/services/$serviceId"
                    params={{ serviceId: record.id }}
                  >
                    Abrir <span aria-hidden="true">→</span>
                  </Link>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
