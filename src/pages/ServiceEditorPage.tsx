import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import type { ServiceItem } from '../contracts/service'
import { ItemEditor } from '../features/services/ItemEditor'
import { useServices } from '../features/services/useServices'
import {
  downloadService,
  exportService,
  localDateTime,
  type ServiceRecord,
} from '../domain/service/service'

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
  const { records, save } = useServices()
  const record = records.find((entry) => entry.id === serviceId)
  const [tab, setTab] = useState<'information' | 'order' | 'presentation'>(
    'order',
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (!record)
    return (
      <div className="empty-state">
        <h1>Servicio no encontrado</h1>
        <Link to="/services">Volver a servicios</Link>
      </div>
    )

  function persist(next: ServiceRecord) {
    try {
      save(next)
      setError('')
      setNotice('Guardado en este navegador')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar')
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

  return (
    <>
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
                        {item.song.sections.length} secciones
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
            Exporta el servicio como JSON 0.1. El archivo lleva letra, acordes y
            texto bíblico para poder presentarlo sin red.
          </p>
          <div className="actions">
            <button className="button primary" onClick={download}>
              Exportar Service 0.1
            </button>
            <Link className="button secondary" to="/development/contract">
              Revisar contrato
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
