import type { ServiceRecord } from '../../domain/service/service'
import type { PersistenceStatus } from '../../repositories/ServiceRepository'

function downloadConflicts(records: ServiceRecord[]): void {
  const blob = new Blob([`${JSON.stringify(records, null, 2)}\n`], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'lvm-service-borradores-en-conflicto.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function ServiceSyncStatus({
  status,
  retry,
  conflicts,
}: {
  status: PersistenceStatus
  retry: () => Promise<void>
  conflicts: () => ServiceRecord[]
}) {
  if (status.mode === 'local') return null

  const message = {
    loading:
      'Conectando con Service API. Tus borradores locales siguen disponibles.',
    pending: 'Cambios guardados en este navegador; sincronización pendiente.',
    synced: 'Servicios sincronizados con PostgreSQL.',
    error:
      'No se pudo conectar con Service API. Los cambios siguen en este navegador.',
  }[status.phase]

  return (
    <div className="panel form-stack" role="status" aria-live="polite">
      <p>{message}</p>
      {status.phase === 'error' && (
        <button className="button secondary" onClick={() => void retry()}>
          Reintentar sincronización
        </button>
      )}
      {status.conflicts > 0 && (
        <div>
          <p>
            {status.conflicts} borrador(es) local(es) tienen el mismo ID que un
            servicio del servidor. Se conservó una copia sin sobrescribir el
            servidor.
          </p>
          <button
            className="button secondary"
            onClick={() => downloadConflicts(conflicts())}
          >
            Descargar copia de conflictos
          </button>
        </div>
      )}
    </div>
  )
}
