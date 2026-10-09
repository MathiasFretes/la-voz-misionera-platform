import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import type { Service, ServiceItem } from '../contracts/service'
import { parseService } from '../contracts/service'
import { parseWorshipPlan } from '../contracts/worshipPlan'
import { ItemEditor } from '../features/services/ItemEditor'
import { useServices } from '../features/services/useServices'
import { ServiceSyncStatus } from '../features/services/ServiceSyncStatus'
import {
  downloadService,
  exportService,
  localDateTime,
  type ServiceRecord,
} from '../domain/service/service'
import { applyWorshipPlan, worshipContext } from '../domain/service/worshipPlan'

function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(value, null, 2)}\n`], {
      type: 'application/json',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function itemTitle(item: ServiceItem): string {
  if (item.kind === 'SONG') return item.song.title
  if (item.kind === 'SCRIPTURE')
    return `${item.scripture.reference} · ${item.scripture.version}`
  if (item.kind === 'SERMON') return item.sermon.title
  return item.announcement.title
}

const kindLabels: Record<ServiceItem['kind'], string> = {
  SONG: 'Canción',
  SCRIPTURE: 'Biblia',
  ANNOUNCEMENT: 'Anuncio',
  SERMON: 'Predicación',
}

export function ServiceEditorPage() {
  const { serviceId } = useParams({ strict: false }) as { serviceId: string }
  const { records, save, persistence, retry, migrationConflicts } =
    useServices()
  const record = records.find((entry) => entry.id === serviceId)
  const [tab, setTab] = useState<'information' | 'order' | 'presentation'>(
    'order',
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingPlan, setPendingPlan] = useState<{
    filename: string
    service: Service
    songTitles: string[]
    replacing: number
  } | null>(null)

  if (!record && persistence.phase === 'loading')
    return (
      <div className="empty-state">
        <p>Cargando servicio...</p>
      </div>
    )

  if (!record)
    return (
      <div className="empty-state">
        <h1>Servicio no encontrado</h1>
        <ServiceSyncStatus
          status={persistence}
          retry={retry}
          conflicts={migrationConflicts}
        />
        <Link to="/services">Volver a servicios</Link>
      </div>
    )

  function persist(next: ServiceRecord): boolean {
    try {
      save(next)
      setError('')
      setNotice('Guardado en este navegador')
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar')
      return false
    }
  }

  function updateItems(items: ServiceItem[]) {
    persist({ ...record!, service: { ...record!.service, items } })
  }

  function saveItem(item: ServiceItem) {
    const items = [...record!.service.items]
    const index = items.findIndex((entry) => entry.id === item.id)
    if (index < 0) items.push(item)
    else items[index] = item
    updateItems(items)
    setAdding(false)
    setEditingId(null)
  }

  function move(index: number, direction: -1 | 1) {
    const items = [...record!.service.items]
    const other = index + direction
    if (other < 0 || other >= items.length) return
    ;[items[index], items[other]] = [items[other], items[index]]
    updateItems(items)
  }

  function download() {
    try {
      downloadService(exportService(record!))
      setError('')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'El contrato aún no es válido',
      )
    }
  }

  const afterItemId =
    record.worshipAfterItemId ??
    (record.service.items[0]?.kind !== 'SONG'
      ? record.service.items[0]?.id
      : '') ??
    ''

  async function importWorshipPlan(file: File) {
    try {
      const plan = parseWorshipPlan(JSON.parse(await file.text()))
      const service = parseService(
        applyWorshipPlan(record!.service, plan, afterItemId || undefined),
      )
      setPendingPlan({
        filename: file.name,
        service,
        songTitles: plan.songs.map((song) => song.title),
        replacing: record!.service.items.filter((item) =>
          item.id.startsWith(`lvm-worship:${record!.service.id}:`),
        ).length,
      })
      setError('')
      setNotice('Revisa el repertorio antes de aplicarlo')
    } catch (cause) {
      setPendingPlan(null)
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo importar el repertorio',
      )
    }
  }

  let presenterError = ''
  try {
    parseService(record.service)
  } catch (cause) {
    presenterError =
      cause instanceof Error ? cause.message : 'El servicio no es válido'
  }
  let worshipHandoffUrl = ''
  const configuredWorshipUrl = import.meta.env.VITE_WORSHIP_URL?.trim()
  if (configuredWorshipUrl) {
    try {
      const url = new URL(configuredWorshipUrl)
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        throw new Error('Unsupported Worship URL')
      url.searchParams.set('returnTo', window.location.href)
      worshipHandoffUrl = url.toString()
    } catch {
      // The file exchange remains usable when the companion URL is absent.
    }
  }

  return (
    <>
      <ServiceSyncStatus
        status={persistence}
        retry={retry}
        conflicts={migrationConflicts}
      />
      <Link to="/services" className="back-link">
        ← Servicios
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Servicio local</p>
          <h1>{record.service.title || 'Sin título'}</h1>
          <p>
            {new Intl.DateTimeFormat('es-PY', {
              dateStyle: 'full',
              timeStyle: 'short',
            }).format(new Date(record.service.startsAt))}{' '}
            · {record.venue || 'Sin sede'}
          </p>
        </div>
        <span className="save-status">{notice}</span>
      </div>
      <div className="tabs" role="tablist" aria-label="Secciones del servicio">
        <button
          role="tab"
          aria-selected={tab === 'information'}
          onClick={() => setTab('information')}
        >
          Información
        </button>
        <button
          role="tab"
          aria-selected={tab === 'order'}
          onClick={() => setTab('order')}
        >
          Orden
        </button>
        <button
          role="tab"
          aria-selected={tab === 'presentation'}
          onClick={() => setTab('presentation')}
        >
          Presentación
        </button>
      </div>
      {error && (
        <p role="alert" className="error panel">
          {error}
        </p>
      )}
      {tab === 'information' && (
        <div className="panel form-stack narrow-page">
          <label>
            Nombre
            <input
              value={record.service.title}
              onChange={(event) =>
                persist({
                  ...record,
                  service: {
                    ...record.service,
                    title: event.target.value,
                    setlist: {
                      ...record.service.setlist,
                      name: event.target.value,
                    },
                  },
                })
              }
            />
          </label>
          <label>
            Fecha y hora
            <input
              type="datetime-local"
              value={localDateTime(record.service.startsAt)}
              onChange={(event) => {
                if (event.target.value)
                  persist({
                    ...record,
                    service: {
                      ...record.service,
                      startsAt: new Date(event.target.value).toISOString(),
                    },
                  })
              }}
            />
          </label>
          <label>
            Sede
            <input
              value={record.venue}
              onChange={(event) =>
                persist({ ...record, venue: event.target.value })
              }
            />
          </label>
        </div>
      )}
      {tab === 'order' && (
        <div className="editor-layout">
          <section className="order-panel">
            <div className="section-heading">
              <div>
                <h2>Orden del culto</h2>
                <p>
                  {record.service.items.length} elementos en orden de
                  presentación
                </p>
              </div>
            </div>
            <ol className="order-list">
              {record.service.items.map((item, index) => (
                <li key={item.id} className="order-item">
                  <div className="order-number">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="order-detail">
                    <span className="item-kind">{kindLabels[item.kind]}</span>
                    <strong>{itemTitle(item)}</strong>
                    {item.kind === 'SONG' && (
                      <small>
                        {item.song.key || 'Sin tono'} ·{' '}
                        {item.song.sections.length} secciones ·{' '}
                        {item.id.startsWith(`lvm-worship:${record.service.id}:`)
                          ? 'Worship'
                          : 'Service'}
                      </small>
                    )}
                  </div>
                  <div className="item-actions">
                    <button
                      aria-label={`Subir ${itemTitle(item)}`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Bajar ${itemTitle(item)}`}
                      disabled={index === record.service.items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => {
                        setAdding(false)
                        setEditingId(item.id)
                      }}
                    >
                      Editar
                    </button>
                    <button
                      aria-label={`Quitar ${itemTitle(item)}`}
                      onClick={() =>
                        updateItems(
                          record.service.items.filter(
                            (entry) => entry.id !== item.id,
                          ),
                        )
                      }
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="panel form-stack">
              <h3>Repertorio de Worship</h3>
              <p>
                Service conserva el culto. Descarga su contexto, prepáralo en
                Worship y vuelve con el archivo WorshipPlan 0.1. Las canciones
                creadas aquí se conservan.
              </p>
              <label>
                Colocar el bloque musical después de
                <select
                  value={afterItemId}
                  onChange={(event) =>
                    persist({
                      ...record,
                      worshipAfterItemId: event.target.value,
                    })
                  }
                >
                  <option value="">Inicio del culto</option>
                  {record.service.items
                    .filter((item) => item.kind !== 'SONG')
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {itemTitle(item)}
                      </option>
                    ))}
                </select>
              </label>
              <div className="actions">
                <button
                  className="button secondary"
                  onClick={() =>
                    downloadJson(
                      worshipContext(record.service),
                      `${record.service.id}-worship-context.json`,
                    )
                  }
                >
                  1. Descargar contexto para Worship
                </button>
                {worshipHandoffUrl && (
                  <a
                    className="button secondary"
                    href={worshipHandoffUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir LVM Worship
                  </a>
                )}
                <label className="button primary">
                  2. Seleccionar WorshipPlan 0.1
                  <input
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void importWorshipPlan(file)
                      event.target.value = ''
                    }}
                  />
                </label>
              </div>
              {!worshipHandoffUrl && (
                <p className="hint">
                  Abre LVM Worship y selecciona el contexto descargado. Esta
                  instalación no tiene configurada la URL local de Worship.
                </p>
              )}
              {pendingPlan && (
                <div
                  className="handoff-preview"
                  role="region"
                  aria-label="Vista previa del repertorio de Worship"
                >
                  <h4>Revisar antes de importar</h4>
                  <p>
                    Archivo: <strong>{pendingPlan.filename}</strong>
                  </p>
                  <p>
                    Se reemplazarán {pendingPlan.replacing} canciones anteriores
                    de Worship por {pendingPlan.songTitles.length} canciones.
                    Los demás elementos del culto se conservarán.
                  </p>
                  <ol>
                    {pendingPlan.songTitles.map((title, index) => (
                      <li key={`${index}-${title}`}>{title}</li>
                    ))}
                  </ol>
                  <div className="actions">
                    <button
                      className="button primary"
                      onClick={() => {
                        if (
                          persist({
                            ...record,
                            worshipAfterItemId: afterItemId,
                            service: pendingPlan.service,
                          })
                        ) {
                          setPendingPlan(null)
                          setNotice(
                            'Repertorio de Worship importado y guardado',
                          )
                        }
                      }}
                    >
                      Confirmar importación
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setPendingPlan(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
            {!record.service.items.length && (
              <p className="hint">
                Agrega la bienvenida, canciones, Biblia, anuncios o predicación.
              </p>
            )}
            <button
              className="button secondary"
              onClick={() => {
                setEditingId(null)
                setAdding(true)
              }}
            >
              + Agregar elemento
            </button>
          </section>
          {(adding || editingId) && (
            <ItemEditor
              key={editingId ?? 'new'}
              initial={
                record.service.items.find((item) => item.id === editingId) ??
                null
              }
              onSave={saveItem}
              onCancel={() => {
                setAdding(false)
                setEditingId(null)
              }}
            />
          )}
        </div>
      )}
      {tab === 'presentation' && (
        <div className="panel narrow-page form-stack">
          <h2>Preparar Presenter</h2>
          <p>
            Revisa el orden y descarga Service 0.1. Abre el archivo desde LVM
            Presenter para presentarlo sin red.
          </p>
          <p role="status" className={presenterError ? 'error' : 'save-status'}>
            {presenterError
              ? `Service inválido: ${presenterError}`
              : 'Service válido para Presenter'}
          </p>
          <ol className="handoff-order">
            {record.service.items.map((item) => (
              <li key={item.id}>{itemTitle(item)}</li>
            ))}
          </ol>
          <div className="actions">
            <button
              className="button primary"
              onClick={download}
              disabled={!!presenterError}
            >
              Descargar para Presenter
            </button>
            {import.meta.env.DEV && (
              <Link className="button secondary" to="/development/contract">
                Revisar contrato
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  )
}
