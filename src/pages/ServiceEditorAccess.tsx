import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { usePlanning } from '../features/services/PlanningContext'
import { useServices } from '../features/services/useServices'
import { ServiceEditorPage } from './ServiceEditorPage'
import {
  downloadService,
  downloadServiceDraft,
  exportService,
} from '../domain/service/service'
import { ServiceSyncStatus } from '../features/services/ServiceSyncStatus'
import { Button } from '../ui/Button'
import { useSuiteUser } from '../features/auth/SuiteAuth'
import { WorshipReview } from '../features/services/WorshipReview'

export function ServiceEditorAccess() {
  const planning = usePlanning()
  if (!planning || planning.canEdit) return <ServiceEditorPage />
  return <ReadonlyService />
}
function ReadonlyService() {
  const planning = usePlanning()
  const user = useSuiteUser()
  const { serviceId } = useParams({ strict: false })
  const { records, persistence, retry, migrationConflicts } = useServices()
  const record = records.find((row) => row.id === serviceId)
  const [error, setError] = useState('')
  if (!record)
    return (
      <section>
        <h1>
          {persistence.phase === 'loading'
            ? 'Cargando servicio…'
            : 'Servicio no disponible en esta iglesia'}
        </h1>
        <Link to="/services">Volver a servicios</Link>
      </section>
    )
  return (
    <section className="form-stack">
      <ServiceSyncStatus
        status={persistence}
        retry={retry}
        conflicts={migrationConflicts}
      />
      <Link to="/services">Volver a servicios</Link>
      <p className="eyebrow">Consulta · sin permisos de edición</p>
      {(persistence.phase === 'pending' || persistence.phase === 'error') && (
        <p>
          Los cambios pendientes se conservan en este dispositivo. No se
          enviarán mientras tu cuenta no tenga permiso de edición.
        </p>
      )}
      <h1>{record.service.title}</h1>
      {import.meta.env.VITE_SERVICE_WORSHIP === 'connected' &&
        user &&
        planning?.selected &&
        planning.selected !== 'legacy' && (
          <WorshipReview
            userId={user.id}
            churchId={planning.selected}
            record={record}
            persistence={persistence}
            refreshService={retry}
          />
        )}
      <p>{record.venue}</p>
      <ol>
        {record.service.items.map((item) => (
          <li key={item.id}>
            {item.kind === 'SONG'
              ? item.song.title
              : item.kind === 'SCRIPTURE'
                ? item.scripture.reference
                : item.kind === 'SERMON'
                  ? item.sermon.title
                  : item.announcement.title}
          </li>
        ))}
      </ol>
      <Button
        disabled={!record.service.items.length}
        onClick={() => {
          try {
            downloadService(exportService(record))
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : 'No se pudo exportar el servicio',
            )
          }
        }}
      >
        Descargar Service 0.1
      </Button>
      <Button onClick={() => downloadServiceDraft(record)}>
        Descargar borrador local
      </Button>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
