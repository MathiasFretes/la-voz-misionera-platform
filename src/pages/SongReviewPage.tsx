import { useEffect, useRef, useState } from 'react'
import { canReviewSongs, useSuiteUser } from '../features/auth/SuiteAuth'
import {
  listSongProposals,
  getReviewSong,
  reviewSongProposal,
  rebaseSongProposal,
  type SongProposal,
} from '../features/content/songReviewRepository'
import { Button } from '../ui/Button'

const labels = {
  addition: 'Nueva canción',
  edit: 'Edición',
  deletion: 'Eliminación',
}
const fields = {
  artist: 'Artista / autor',
  default_key: 'Tono',
  tags: 'Etiquetas',
  tempo: 'Tempo (BPM)',
  time_signature: 'Compás',
  language: 'Idioma',
  country: 'País',
}
const text = (value: unknown) =>
  Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value)

function ReviewQueue({ admin }: { admin: boolean }) {
  const [rows, setRows] = useState<SongProposal[]>([])
  const [selected, setSelected] = useState<SongProposal | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reason, setReason] = useState('')
  const [decision, setDecision] = useState<
    'approve' | 'reject' | 'rebase' | null
  >(null)
  const [more, setMore] = useState(false)
  const [currentSong, setCurrentSong] = useState<
    (Record<string, unknown> & { slug: string }) | null
  >(null)

  const stale =
    !!selected?.song_id &&
    selected.type !== 'addition' &&
    !!currentSong &&
    (!selected.base_song_updated_at ||
      selected.base_song_updated_at !== currentSong.updated_at)
  const detail = useRef<HTMLElement>(null)
  useEffect(() => {
    if (selected) detail.current?.focus()
  }, [selected])

  useEffect(() => {
    let active = true
    if (selected?.song_id)
      getReviewSong(selected.song_id)
        .then((song) => {
          if (active) setCurrentSong(song)
        })
        .catch((cause) => {
          if (active) setError(cause.message)
        })
    return () => {
      active = false
    }
  }, [selected?.id, selected?.song_id])

  useEffect(() => {
    let active = true
    listSongProposals()
      .then((data) => {
        if (active) {
          setRows(data)
          setMore(data.length === 25)
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message)
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function load(append = false) {
    setBusy(true)
    setError('')
    try {
      const data = await listSongProposals(append ? rows.length : 0)
      setRows((current) => (append ? [...current, ...data] : data))
      setMore(data.length === 25)
      if (!append) {
        setSelected(null)
        setCurrentSong(null)
        setDecision(null)
        setReason('')
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo cargar la bandeja',
      )
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!selected || !decision || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (decision === 'rebase') {
        const result = await rebaseSongProposal(
          selected.id,
          String(currentSong?.updated_at || ''),
        )
        setSelected(result)
        setRows((current) =>
          current.map((row) => (row.id === result.id ? result : row)),
        )
        setDecision(null)
        setNotice(
          'Base actualizada tras la comparación. La propuesta todavía no está aprobada.',
        )
        return
      }
      await reviewSongProposal(selected.id, decision, reason)
      setNotice(
        decision === 'approve'
          ? 'Propuesta aprobada y guardada.'
          : 'Propuesta rechazada. El borrador vuelve a su autor.',
      )
      setRows((current) => current.filter((row) => row.id !== selected.id))
      setSelected(null)
      setCurrentSong(null)
      setDecision(null)
      setReason('')
      // Decisions shift offsets, so start pagination again after each review.
      const data = await listSongProposals()
      setRows(data)
      setMore(data.length === 25)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo confirmar la decisión. Reintentá para comprobar su resultado.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <p className="eyebrow">LVM Service · Biblioteca musical</p>
      <h1>Revisión de canciones</h1>
      <p>
        Revisá las propuestas de Worship. Solo la aprobación publica los cambios
        en la biblioteca.
      </p>
      <div className="actions">
        <Button onClick={() => void load()} loading={busy}>
          Actualizar bandeja
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">Comprobando propuestas…</p>}
      {!busy && !rows.length && !error && <p>No hay propuestas pendientes.</p>}
      <div className="song-review-layout">
        <section className="form-stack" aria-label="Propuestas pendientes">
          {rows.map((row) => (
            <article className="panel" key={row.id}>
              <p className="eyebrow">{labels[row.type]}</p>
              <h2>{text(row.payload.title) || 'Sin título'}</h2>
              <p>{new Date(row.created_at).toLocaleString('es-PY')}</p>
              <Button
                disabled={busy}
                aria-pressed={selected?.id === row.id}
                onClick={() => {
                  setSelected(row)
                  setCurrentSong(null)
                  setDecision(null)
                  setReason('')
                  setError('')
                  setNotice('')
                }}
              >
                Revisar {text(row.payload.title) || 'propuesta'}
              </Button>
            </article>
          ))}
          {more && (
            <Button disabled={busy} onClick={() => void load(true)}>
              Cargar más propuestas
            </Button>
          )}
        </section>
        {selected && (
          <section
            className="panel form-stack song-review-detail"
            aria-label="Detalle de la propuesta"
            ref={detail}
            tabIndex={-1}
          >
            <p className="eyebrow">{labels[selected.type]}</p>
            <h2>{text(selected.payload.title) || 'Sin título'}</h2>
            <dl>
              {Object.entries(fields).map(([field, label]) =>
                text(selected.payload[field]) ? (
                  <div key={field}>
                    <dt>{label}</dt>
                    <dd>{text(selected.payload[field])}</dd>
                  </div>
                ) : null,
              )}
            </dl>
            {selected.type === 'deletion' ? (
              <p>
                Se solicita retirar esta canción del catálogo. Se requiere
                aprobación administrativa.
              </p>
            ) : (
              <>
                <h3>Letra y acordes propuestos</h3>
                <pre className="song-review-chart">
                  {text(selected.payload.chordpro_content)}
                </pre>
              </>
            )}
            {currentSong && (
              <details>
                <summary>Versión publicada actual</summary>
                <p>
                  {text(currentSong.title)} · {text(currentSong.default_key)}
                </p>
                <pre className="song-review-chart">
                  {text(currentSong.chordpro_content)}
                </pre>
                <a
                  className="button secondary"
                  href={`/portal/editor/${encodeURIComponent(currentSong.slug)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver canción en Worship
                </a>
              </details>
            )}
            <label>
              Motivo del rechazo (opcional)
              <textarea
                value={reason}
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {stale && (
              <section className="notice" aria-label="Propuesta desactualizada">
                <p>
                  La canción cambió desde que se preparó la propuesta, o su
                  revisión base es desconocida. Compará la versión publicada con
                  la propuesta antes de continuar.
                </p>
                <Button disabled={busy} onClick={() => setDecision('rebase')}>
                  Comparé las versiones; actualizar base
                </Button>
              </section>
            )}
            {!decision ? (
              <div className="actions">
                {(selected.type !== 'deletion' || admin) && (
                  <Button
                    disabled={
                      busy || (!!selected.song_id && !currentSong) || stale
                    }
                    onClick={() => setDecision('approve')}
                  >
                    Aprobar propuesta
                  </Button>
                )}
                <Button disabled={busy} onClick={() => setDecision('reject')}>
                  Rechazar propuesta
                </Button>
              </div>
            ) : (
              <section className="notice" aria-label="Confirmar revisión">
                <p>
                  {decision === 'approve'
                    ? '¿Confirmás publicar esta propuesta en la biblioteca?'
                    : decision === 'rebase'
                      ? '¿Confirmás usar la versión publicada que acabás de comparar como nueva base? Se registrará la decisión; esto no publica la propuesta.'
                      : '¿Confirmás rechazar esta propuesta sin cambiar la canción publicada?'}
                </p>
                <div className="actions">
                  <Button
                    variant={decision === 'reject' ? 'danger' : 'primary'}
                    loading={busy}
                    onClick={() => void confirm()}
                  >
                    {decision === 'approve'
                      ? 'Confirmar aprobación'
                      : decision === 'rebase'
                        ? 'Confirmar actualización de base'
                        : 'Confirmar rechazo'}
                  </Button>
                  <Button disabled={busy} onClick={() => setDecision(null)}>
                    Seguir revisando
                  </Button>
                </div>
              </section>
            )}
          </section>
        )}
      </div>
    </section>
  )
}

export function SongReviewPage() {
  const user = useSuiteUser()
  if (!canReviewSongs(user))
    return (
      <section>
        <h1>Revisión de canciones</h1>
        <p>Necesitás un rol de editor para revisar propuestas.</p>
      </section>
    )
  return (
    <ReviewQueue
      key={user!.id}
      admin={['admin', 'owner'].includes(user!.role)}
    />
  )
}
