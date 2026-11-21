import { useEffect, useRef, useState } from 'react'
import type { WorshipContext, WorshipPlan } from '../../contracts/worshipPlan'
import type { ServiceRecord } from '../../domain/service/service'
import type { PersistenceStatus } from '../../repositories/ServiceRepository'
import { Button } from '../../ui/Button'

export type WorshipExchange = {
  context: WorshipContext
  plan: WorshipPlan | null
  revision: number
  serviceRevision: number
  basedOnServiceRevision: number | null
  appliedPlanRevision: number | null
  appliedServiceRevision: number | null
  canPrepare: boolean
  canApply: boolean
}
export function WorshipReview({
  userId,
  churchId,
  record,
  persistence,
  refreshService,
}: {
  userId: string
  churchId: string
  record: ServiceRecord
  persistence: PersistenceStatus
  refreshService: () => Promise<void>
}) {
  const scope = JSON.stringify([userId, churchId, record.id])
  return (
    <ScopedWorshipReview
      key={scope}
      userId={userId}
      churchId={churchId}
      record={record}
      persistence={persistence}
      refreshService={refreshService}
    />
  )
}
function ScopedWorshipReview({
  userId,
  churchId,
  record,
  persistence,
  refreshService,
}: Parameters<typeof WorshipReview>[0]) {
  const operationKey = `lvm.service.worship-apply.v1:${JSON.stringify([userId, churchId, record.id])}`
  const [exchange, setExchange] = useState<WorshipExchange | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [version, setVersion] = useState(0)
  const pending = useRef<{
    id: string
    input: { revision: number; serviceRevision: number }
  } | null>(null)
  const lifetime = useRef(new AbortController())
  const path = `/api/churches/${churchId}/services/${encodeURIComponent(record.id)}/worship`
  const synced = persistence.phase === 'synced'
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'X-LVM-Account': userId },
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok)
          throw new Error(
            result.message || 'No se pudo consultar el repertorio',
          )
        return result as WorshipExchange
      })
      .then((result) => {
        if (active) {
          setExchange(result)
          setError('')
        }
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [path, userId, record.revision, version])
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])
  const stale =
    !!exchange &&
    (exchange.serviceRevision !== record.revision ||
      exchange.basedOnServiceRevision !== exchange.serviceRevision)
  const applied =
    !!exchange?.plan && exchange.appliedPlanRevision === exchange.revision
  async function incorporate() {
    if (!exchange?.plan || !synced || !exchange.canApply || stale || applied)
      return
    const input = {
      revision: exchange.revision,
      serviceRevision: exchange.serviceRevision,
    }
    if (
      !pending.current ||
      JSON.stringify(pending.current.input) !== JSON.stringify(input)
    ) {
      try {
        const cached = JSON.parse(localStorage.getItem(operationKey) || 'null')
        pending.current =
          cached &&
          /^[a-f0-9-]{36}$/.test(cached.id) &&
          JSON.stringify(cached.input) === JSON.stringify(input)
            ? cached
            : { id: crypto.randomUUID(), input }
        localStorage.setItem(operationKey, JSON.stringify(pending.current))
      } catch {
        setError(
          'No se pudo conservar la operación en este dispositivo. No se envió la incorporación.',
        )
        return
      }
    }
    const operation = pending.current
    if (!operation) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`${path}/apply`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'X-LVM-Account': userId,
          'X-LVM-Operation': operation.id,
        },
        body: JSON.stringify(input),
        signal: lifetime.current.signal,
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.message || 'No se pudo incorporar el repertorio')
      pending.current = null
      localStorage.removeItem(operationKey)
      if (lifetime.current.signal.aborted) return
      await refreshService()
      setNotice(
        'Repertorio incorporado al culto. Los elementos manuales se conservaron.',
      )
      setConfirm(false)
      setVersion((value) => value + 1)
    } catch (error) {
      if (!lifetime.current.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : 'No se pudo incorporar el repertorio',
        )
    } finally {
      if (!lifetime.current.signal.aborted) setBusy(false)
    }
  }
  return (
    <section
      className="panel form-stack"
      aria-label="Repertorio conectado de Worship"
    >
      <h2>Repertorio de Worship</h2>
      <p>
        Los músicos envían la propuesta musical. Incorporarla reemplaza
        solamente el bloque de Worship y conserva los elementos preparados en
        Service.
      </p>
      {!synced && (
        <p role="status">
          Sincronizá los cambios del culto antes de revisar o incorporar la
          propuesta.
        </p>
      )}
      {loading && <p role="status">Consultando repertorio…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="actions">
        <Button
          loading={loading}
          disabled={busy || !synced}
          onClick={() => {
            setLoading(true)
            setConfirm(false)
            setVersion((value) => value + 1)
          }}
        >
          Actualizar repertorio
        </Button>
        {synced && exchange?.canPrepare && (
          <a
            className="button secondary"
            href={`/setlist?churchId=${encodeURIComponent(churchId)}&serviceId=${encodeURIComponent(record.id)}`}
          >
            Preparar en Worship
          </a>
        )}
      </div>
      {exchange && !exchange.plan && (
        <p>Todavía no se recibió una propuesta musical para este culto.</p>
      )}
      {exchange?.plan && (
        <>
          <p>
            Propuesta musical · revisión {exchange.revision} · culto revisado{' '}
            {exchange.basedOnServiceRevision}
          </p>
          <ol>
            {exchange.plan.songs.map((song, index) => (
              <li key={`${index}:${song.songId}`}>
                <strong>{song.title}</strong> · {song.key || 'Sin tono'} ·{' '}
                {song.sections.length} secciones
              </li>
            ))}
          </ol>
          {applied && (
            <p role="status">Esta propuesta ya fue incorporada al culto.</p>
          )}
          {!applied && stale && (
            <p role="alert">
              El culto cambió desde que se preparó la propuesta. Los músicos
              deben revisar el contexto actualizado y volver a enviarla.
            </p>
          )}
          {!applied && !stale && exchange.canApply && (
            <Button
              variant="primary"
              disabled={!synced || busy}
              onClick={() => setConfirm(true)}
            >
              Revisar incorporación
            </Button>
          )}
          {confirm && !applied && (
            <section
              role="alertdialog"
              aria-labelledby="worship-apply-title"
              className="form-stack"
            >
              <h3 id="worship-apply-title">Incorporar la propuesta musical</h3>
              <p>
                Se reemplazarán las canciones incorporadas anteriormente desde
                Worship. Los anuncios, lecturas y elementos manuales se
                conservarán.
              </p>
              <div className="actions">
                <Button
                  variant="primary"
                  disabled={!synced || stale}
                  loading={busy}
                  onClick={() => {
                    void incorporate()
                  }}
                >
                  Confirmar incorporación
                </Button>
                <Button disabled={busy} onClick={() => setConfirm(false)}>
                  Seguir revisando
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  )
}
