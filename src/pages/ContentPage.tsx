import { useCallback, useEffect, useState } from 'react'
import {
  contentCollections,
  validateSiteDocument,
  type ContentCollection,
  type ContentInput,
} from '../../suite-api/site-content.mjs'
import {
  listSiteDocuments,
  saveSiteDocument,
  type SiteDocument,
} from '../features/content/repository'
import { Button } from '../ui/Button'

function publicationState(document: SiteDocument | null) {
  if (!document?.published) return 'Borrador'
  return JSON.stringify(document.data) === JSON.stringify(document.draft_data)
    ? 'Publicado'
    : 'Publicado · cambios sin publicar'
}

function ContentEditor({
  schema,
  document,
  onSaved,
  onDirty,
  onBusy,
  onReload,
}: {
  schema: ContentCollection
  document: SiteDocument | null
  onSaved: (document: SiteDocument) => void
  onDirty: (dirty: boolean) => void
  onBusy: (busy: boolean) => void
  onReload: () => void
}) {
  const initial = () =>
    Object.fromEntries(
      schema.fields.map((field) => [
        field.key,
        document?.draft_data[field.key] ?? field.value,
      ]),
    )
  const [values, setValues] =
    useState<Record<string, string | boolean>>(initial)
  const [id] = useState(() => document?.id || crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  function edit(key: string, value: string | boolean) {
    setValues((previous) => ({ ...previous, [key]: value }))
    setDirty(true)
    onDirty(true)
  }
  async function save(action: ContentInput['p_action']) {
    setError('')
    setBusy(true)
    onBusy(true)
    const input = {
      p_collection: schema.id,
      p_id: id,
      p_data: values,
      p_expected_revision: document?.revision || 0,
      p_action: action,
    }
    try {
      validateSiteDocument(input)
      const result = await saveSiteDocument(input)
      setDirty(false)
      onDirty(false)
      onSaved(result)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
      onBusy(false)
    }
  }
  return (
    <section className="card form-stack" aria-label="Editor de contenido">
      <header>
        <p className="eyebrow">
          {dirty ? 'Cambios sin guardar' : publicationState(document)}
        </p>
        <h2>{document ? 'Editar contenido' : 'Nuevo contenido'}</h2>
      </header>
      <p>
        Guardar un borrador no modifica la web. Publicar aplica los cambios para
        los visitantes.
      </p>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault()
          void save('publish')
        }}
      >
        <fieldset disabled={busy} className="content-fields">
          {schema.fields.map((field) => (
            <label
              key={field.key}
              className={field.type === 'boolean' ? 'public-checkbox' : ''}
            >
              {field.label}
              {field.required ? ' *' : ''}
              {field.type === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={values[field.key] === true}
                  onChange={(event) => edit(field.key, event.target.checked)}
                />
              ) : field.type === 'textarea' ? (
                <textarea
                  rows={5}
                  value={String(values[field.key] ?? '')}
                  onChange={(event) => edit(field.key, event.target.value)}
                />
              ) : (
                <input
                  type={field.type}
                  required={field.required}
                  value={String(values[field.key] ?? '')}
                  onChange={(event) => edit(field.key, event.target.value)}
                />
              )}
            </label>
          ))}
        </fieldset>
        {error && (
          <div role="alert">
            <p>{error}</p>
            <p>
              Tus cambios siguen en el formulario. Si hay otra revisión,
              copialos antes de cargar la versión actual.
            </p>
            <Button type="button" onClick={onReload}>
              Cargar versión actual
            </Button>
          </div>
        )}
        <div className="actions">
          <Button
            type="button"
            loading={busy}
            onClick={() => void save('save')}
          >
            Guardar borrador
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Publicar
          </Button>
          {document?.published && (
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => void save('unpublish')}
            >
              Retirar de la web
            </Button>
          )}
          {dirty && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setValues(initial())
                setDirty(false)
                onDirty(false)
                setError('')
              }}
            >
              Descartar cambios
            </Button>
          )}
        </div>
      </form>
      {document && (
        <small>
          Revisión {document.revision} ·{' '}
          {new Date(document.updated_at).toLocaleString()}
        </small>
      )}
    </section>
  )
}

export function ContentPage() {
  const [collection, setCollection] = useState(contentCollections[0].id)
  const [documents, setDocuments] = useState<SiteDocument[]>([])
  const [selection, setSelection] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const schema = contentCollections.find((item) => item.id === collection)!
  const selected =
    documents.find((document) => document.id === selection) || null
  const reload = useCallback(() => {
    setDirty(false)
    setRevision((value) => value + 1)
  }, [])
  useEffect(() => {
    let active = true
    listSiteDocuments(collection)
      .then((rows) => {
        if (active) {
          setDocuments(rows)
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
    }
  }, [collection, revision])
  return (
    <section>
      <p className="eyebrow">Administración de la web</p>
      <h1>Contenido público</h1>
      <p>
        Creá, revisá y publicá el contenido de La Voz Misionera desde LVM
        Service. La web puede tardar hasta 30 segundos en actualizar una página
        abierta.
      </p>
      <div className="actions form-stack">
        <label>
          Sección
          <select
            value={collection}
            disabled={dirty || saving}
            onChange={(event) => {
              setCollection(event.target.value)
              setSelection(null)
              setDocuments([])
              setLoading(true)
              setNotice('')
              setError('')
            }}
          >
            {contentCollections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={dirty || loading || saving}
          onClick={() => {
            setSelection(null)
            setNotice('')
            setRevision((value) => value + 1)
          }}
        >
          Nuevo contenido
        </Button>
        <a
          className="button secondary"
          href={schema.publicPath}
          target="_blank"
          rel="noreferrer"
        >
          Ver página pública
        </a>
      </div>
      {notice && <p role="status">{notice}</p>}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button onClick={reload}>Reintentar</Button>
        </div>
      ) : loading ? (
        <p role="status">Cargando contenido…</p>
      ) : (
        <div className="content-workspace">
          <section className="card" aria-label="Contenido de la sección">
            <h2>{schema.label}</h2>
            {documents.length === 0 ? (
              <p>Todavía no hay contenido. Podés empezar con un borrador.</p>
            ) : (
              <ul className="content-list">
                {documents.map((document) => (
                  <li key={document.id}>
                    <button
                      disabled={dirty || saving}
                      aria-pressed={selection === document.id}
                      onClick={() => {
                        setSelection(document.id)
                        setNotice('')
                      }}
                    >
                      <strong>
                        {String(
                          document.draft_data[schema.titleField] ||
                            'Sin título',
                        )}
                      </strong>
                      <span>
                        {publicationState(document)} · revisión{' '}
                        {document.revision}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <ContentEditor
            key={`${collection}:${selection || 'new'}:${selected?.revision || 0}:${revision}`}
            schema={schema}
            document={selected}
            onDirty={setDirty}
            onBusy={setSaving}
            onReload={reload}
            onSaved={(document) => {
              setDocuments((previous) => [
                document,
                ...previous.filter((item) => item.id !== document.id),
              ])
              setSelection(document.id)
              setNotice(
                document.published
                  ? 'Cambios guardados. La web muestra la última versión publicada.'
                  : 'Borrador guardado. No está visible en la web.',
              )
            }}
          />
        </div>
      )}
    </section>
  )
}
