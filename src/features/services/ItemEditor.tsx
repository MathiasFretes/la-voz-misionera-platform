import { useState, type FormEvent } from 'react'
import type { ServiceItem } from '../../contracts/service'
import {
  formatSongNotation,
  parseSongNotation,
} from '../../domain/service/songNotation'

type Kind = ServiceItem['kind']

export function ItemEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: ServiceItem | null
  onSave: (item: ServiceItem) => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'ANNOUNCEMENT')
  const [title, setTitle] = useState(
    initial?.kind === 'SONG'
      ? initial.song.title
      : initial?.kind === 'SCRIPTURE'
        ? ''
        : initial?.kind === 'ANNOUNCEMENT'
          ? initial.announcement.title
          : (initial?.sermon.title ?? ''),
  )
  const [body, setBody] = useState(
    initial?.kind === 'SCRIPTURE'
      ? initial.scripture.text
      : initial?.kind === 'ANNOUNCEMENT'
        ? initial.announcement.body
        : initial?.kind === 'SERMON'
          ? initial.sermon.body
          : '',
  )
  const [reference, setReference] = useState(
    initial?.kind === 'SCRIPTURE' ? initial.scripture.reference : '',
  )
  const [version, setVersion] = useState(
    initial?.kind === 'SCRIPTURE' ? initial.scripture.version : 'RV1909',
  )
  const [key, setKey] = useState(
    initial?.kind === 'SONG' ? initial.song.key : '',
  )
  const [notation, setNotation] = useState(
    initial?.kind === 'SONG' ? formatSongNotation(initial.song.sections) : '',
  )
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const id = initial?.id ?? crypto.randomUUID()
      let item: ServiceItem
      if (kind === 'SONG') {
        item = {
          id,
          kind,
          song: {
            id: initial?.kind === 'SONG' ? initial.song.id : `song-${id}`,
            title: title.trim(),
            key: key.trim(),
            sections: parseSongNotation(notation),
          },
        }
      } else if (kind === 'SCRIPTURE') {
        item = {
          id,
          kind,
          scripture: {
            reference: reference.trim(),
            version: version.trim(),
            text: body.trim(),
          },
        }
      } else if (kind === 'SERMON') {
        item = { id, kind, sermon: { title: title.trim(), body: body.trim() } }
      } else {
        item = {
          id,
          kind,
          announcement: { title: title.trim(), body: body.trim() },
        }
      }
      onSave(item)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo guardar el elemento',
      )
    }
  }

  return (
    <form className="panel form-stack item-editor" onSubmit={submit}>
      <div className="section-heading">
        <h2>{initial ? 'Editar elemento' : 'Agregar elemento'}</h2>
        <button type="button" className="text-button" onClick={onCancel}>
          Cerrar
        </button>
      </div>
      <label>
        Tipo
        <select
          value={kind}
          disabled={!!initial}
          onChange={(event) => setKind(event.target.value as Kind)}
        >
          <option value="ANNOUNCEMENT">Bienvenida / anuncio</option>
          <option value="SONG">Canción</option>
          <option value="SCRIPTURE">Biblia</option>
          <option value="SERMON">Predicación</option>
        </select>
      </label>
      {kind === 'SCRIPTURE' ? (
        <>
          <label>
            Referencia
            <input
              required
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Juan 3:16"
            />
          </label>
          <label>
            Versión
            <input
              required
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </label>
          <label>
            Texto local
            <textarea
              required
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
        </>
      ) : (
        <>
          <label>
            {kind === 'SONG' ? 'Título de la canción' : 'Título'}
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={kind === 'ANNOUNCEMENT' ? 'Bienvenida' : ''}
            />
          </label>
          {kind === 'SONG' ? (
            <>
              <label>
                Tonalidad
                <input
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder="G"
                />
              </label>
              <label>
                Secciones y letra
                <textarea
                  required
                  rows={9}
                  value={notation}
                  onChange={(event) => setNotation(event.target.value)}
                  placeholder={
                    '# Verso 1\n[G]Cantamos con fe\n\n# Coro\n[C]Seguimos aquí\n\n# Coro\n[C]Seguimos aquí'
                  }
                />
              </label>
              <p className="hint">
                Usa <code># Verso 1</code> o <code># Coro</code> para cada
                sección y <code>[G]</code> donde cae un acorde. Repite una
                sección para repetirla al presentar.
              </p>
            </>
          ) : (
            <label>
              Texto
              <textarea
                required
                rows={4}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="button primary">
          Guardar elemento
        </button>
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
