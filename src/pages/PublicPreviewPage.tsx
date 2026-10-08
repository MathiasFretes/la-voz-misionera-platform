import { useState } from 'react'
import type {
  PublicContent,
  PublicEvent,
  PublicSermon,
  PublicVenue,
} from '../contracts/publicContent'
import { parsePublicContent } from '../contracts/publicContent'

type Draft = Pick<PublicContent, 'events' | 'sermons' | 'venues'>
const storageKey = 'lvm.public-content.draft.0.1'
const defaultDraft: Draft = {
  events: [
    {
      id: 'encuentro-juvenil',
      title: 'Encuentro Juvenil · ejemplo',
      date: '2026-10-17',
      time: '19:00',
      venue: 'Sede de ejemplo',
      kind: 'encuentro',
      description:
        'Un encuentro de demostración para revisar la vista pública.',
    },
  ],
  sermons: [
    {
      id: 'predica-ejemplo',
      title: 'Viviendo por fe · ejemplo',
      series: 'Mensajes de ejemplo',
      speaker: 'Equipo pastoral · ejemplo',
      date: '2026-10-04',
      duration: '30 min',
      summary: 'Resumen de demostración para revisar la vista pública.',
    },
  ],
  venues: [
    {
      id: 'sede-ejemplo',
      name: 'Sede de ejemplo',
      zone: 'Zona pendiente de publicación',
      address: 'Dirección pendiente de publicación',
      hours: 'Horarios pendientes de publicación',
      isMain: true,
    },
  ],
}

function readDraft(): Draft {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaultDraft
    const value: unknown = JSON.parse(raw)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>
      if (
        Array.isArray(record.events) &&
        Array.isArray(record.sermons) &&
        Array.isArray(record.venues)
      )
        return record as Draft
    }
  } catch {
    // Leave the default fixture available if browser storage is unavailable.
  }
  return defaultDraft
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export function PublicPreviewPage() {
  const [draft, setDraft] = useState(readDraft)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  function commit(next: Draft) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setDraft(next)
      setNotice('Borrador guardado en este navegador')
      setError('')
    } catch {
      setError('No se pudo guardar el borrador local')
    }
  }

  function updateEvent(index: number, patch: Partial<PublicEvent>) {
    commit({
      ...draft,
      events: draft.events.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    })
  }
  function updateSermon(index: number, patch: Partial<PublicSermon>) {
    commit({
      ...draft,
      sermons: draft.sermons.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    })
  }
  function updateVenue(index: number, patch: Partial<PublicVenue>) {
    commit({
      ...draft,
      venues: draft.venues.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    })
  }

  function download() {
    try {
      const content = parsePublicContent({
        schemaVersion: '0.1',
        generatedAt: new Date().toISOString(),
        ...draft,
      })
      const url = URL.createObjectURL(
        new Blob([`${JSON.stringify(content, null, 2)}\n`], {
          type: 'application/json',
        }),
      )
      const link = document.createElement('a')
      link.href = url
      link.download = 'lvm-public-content-0.1.json'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setError('')
      setNotice('PublicContent 0.1 descargado para la preview pública')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'El contenido no es válido',
      )
    }
  }

  let webPreviewUrl = ''
  const configuredWebUrl = import.meta.env.VITE_WEB_PUBLICA_URL?.trim()
  if (configuredWebUrl) {
    try {
      const url = new URL('/preview/import', configuredWebUrl)
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        throw new Error('Invalid URL')
      url.searchParams.set('returnTo', window.location.href)
      webPreviewUrl = url.toString()
    } catch {
      // A file remains usable without a configured companion URL.
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">M7.9C · contenido local</p>
          <h1>Vista previa pública</h1>
          <p>
            Prepara ejemplos en Service y revísalos en LVM Web Pública mediante
            PublicContent 0.1. Esto no publica contenido ni requiere API.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      <div className="panel form-stack">
        <h2>Intercambio por archivo</h2>
        <p>
          1. Completa los datos. 2. Descarga el archivo. 3. Ábrelo en la preview
          de Web Pública.
        </p>
        <div className="actions">
          <button className="button primary" onClick={download}>
            Descargar PublicContent 0.1
          </button>
          {webPreviewUrl && (
            <a
              className="button secondary"
              href={webPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir LVM Web Pública
            </a>
          )}
        </div>
        {!webPreviewUrl && (
          <p className="hint">
            Abre LVM Web Pública y selecciona el archivo descargado. No hay URL
            local configurada.
          </p>
        )}
      </div>
      <div className="public-editor-sections">
        <section
          className="panel form-stack"
          aria-labelledby="public-events-title"
        >
          <h2 id="public-events-title">Eventos</h2>
          {draft.events.map((event, index) => (
            <div className="public-editor-card" key={event.id}>
              <Field
                label="Título"
                value={event.title}
                onChange={(value) => updateEvent(index, { title: value })}
              />
              <div className="public-editor-grid">
                <Field
                  label="Fecha"
                  type="date"
                  value={event.date}
                  onChange={(value) => updateEvent(index, { date: value })}
                />
                <Field
                  label="Hora"
                  type="time"
                  value={event.time}
                  onChange={(value) => updateEvent(index, { time: value })}
                />
              </div>
              <Field
                label="Sede"
                value={event.venue}
                onChange={(value) => updateEvent(index, { venue: value })}
              />
              <label>
                Tipo
                <select
                  value={event.kind}
                  onChange={(e) =>
                    updateEvent(index, {
                      kind: e.target.value as PublicEvent['kind'],
                    })
                  }
                >
                  <option value="encuentro">Encuentro</option>
                  <option value="culto">Culto</option>
                </select>
              </label>
              <Field
                label="Descripción"
                value={event.description}
                onChange={(value) => updateEvent(index, { description: value })}
              />
              <button
                className="button secondary"
                onClick={() =>
                  commit({
                    ...draft,
                    events: draft.events.filter((_, i) => i !== index),
                  })
                }
              >
                Quitar evento
              </button>
            </div>
          ))}
          <button
            className="button secondary"
            onClick={() =>
              commit({
                ...draft,
                events: [
                  ...draft.events,
                  {
                    ...defaultDraft.events[0],
                    id: crypto.randomUUID(),
                    title: 'Nuevo evento · ejemplo',
                  },
                ],
              })
            }
          >
            + Agregar evento
          </button>
        </section>
        <section
          className="panel form-stack"
          aria-labelledby="public-sermons-title"
        >
          <h2 id="public-sermons-title">Prédicas</h2>
          {draft.sermons.map((sermon, index) => (
            <div className="public-editor-card" key={sermon.id}>
              <Field
                label="Título"
                value={sermon.title}
                onChange={(value) => updateSermon(index, { title: value })}
              />
              <Field
                label="Serie"
                value={sermon.series}
                onChange={(value) => updateSermon(index, { series: value })}
              />
              <Field
                label="Predicador"
                value={sermon.speaker}
                onChange={(value) => updateSermon(index, { speaker: value })}
              />
              <div className="public-editor-grid">
                <Field
                  label="Fecha"
                  type="date"
                  value={sermon.date}
                  onChange={(value) => updateSermon(index, { date: value })}
                />
                <Field
                  label="Duración"
                  value={sermon.duration}
                  onChange={(value) => updateSermon(index, { duration: value })}
                />
              </div>
              <Field
                label="Resumen"
                value={sermon.summary}
                onChange={(value) => updateSermon(index, { summary: value })}
              />
              <button
                className="button secondary"
                onClick={() =>
                  commit({
                    ...draft,
                    sermons: draft.sermons.filter((_, i) => i !== index),
                  })
                }
              >
                Quitar prédica
              </button>
            </div>
          ))}
          <button
            className="button secondary"
            onClick={() =>
              commit({
                ...draft,
                sermons: [
                  ...draft.sermons,
                  {
                    ...defaultDraft.sermons[0],
                    id: crypto.randomUUID(),
                    title: 'Nueva prédica · ejemplo',
                  },
                ],
              })
            }
          >
            + Agregar prédica
          </button>
        </section>
        <section
          className="panel form-stack"
          aria-labelledby="public-venues-title"
        >
          <h2 id="public-venues-title">Sedes</h2>
          {draft.venues.map((venue, index) => (
            <div className="public-editor-card" key={venue.id}>
              <Field
                label="Nombre"
                value={venue.name}
                onChange={(value) => updateVenue(index, { name: value })}
              />
              <Field
                label="Zona"
                value={venue.zone}
                onChange={(value) => updateVenue(index, { zone: value })}
              />
              <Field
                label="Dirección"
                value={venue.address}
                onChange={(value) => updateVenue(index, { address: value })}
              />
              <Field
                label="Horarios"
                value={venue.hours}
                onChange={(value) => updateVenue(index, { hours: value })}
              />
              <label className="public-checkbox">
                <input
                  type="checkbox"
                  checked={venue.isMain}
                  onChange={(e) =>
                    updateVenue(index, { isMain: e.target.checked })
                  }
                />{' '}
                Sede principal
              </label>
              <button
                className="button secondary"
                onClick={() =>
                  commit({
                    ...draft,
                    venues: draft.venues.filter((_, i) => i !== index),
                  })
                }
              >
                Quitar sede
              </button>
            </div>
          ))}
          <button
            className="button secondary"
            onClick={() =>
              commit({
                ...draft,
                venues: [
                  ...draft.venues,
                  {
                    ...defaultDraft.venues[0],
                    id: crypto.randomUUID(),
                    name: 'Nueva sede · ejemplo',
                    isMain: false,
                  },
                ],
              })
            }
          >
            + Agregar sede
          </button>
        </section>
      </div>
    </>
  )
}
