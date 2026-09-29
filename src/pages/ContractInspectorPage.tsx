import { useState, type ChangeEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { parseService } from '../contracts/service'
import { downloadService, exportService } from '../domain/service/service'
import { useServices } from '../features/services/useServices'

export function ContractInspectorPage() {
  const { records, save } = useServices()
  const [selectedId, setSelectedId] = useState('')
  const [result, setResult] = useState<{ message: string; ok: boolean } | null>(
    null,
  )
  const record = records.find((entry) => entry.id === selectedId) ?? records[0]

  function validate() {
    if (!record) return
    try {
      exportService(record)
      setResult({
        message:
          'Contrato 0.1 válido: ID, fecha, elementos, IDs únicos, texto y acordes.',
        ok: true,
      })
    } catch (cause) {
      setResult({
        message: cause instanceof Error ? cause.message : 'Contrato inválido',
        ok: false,
      })
    }
  }

  function download() {
    if (!record) return
    try {
      downloadService(exportService(record))
      setResult({ message: 'Service 0.1 exportado.', ok: true })
    } catch (cause) {
      setResult({
        message: cause instanceof Error ? cause.message : 'Contrato inválido',
        ok: false,
      })
    }
  }

  async function openFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const service = parseService(JSON.parse(await file.text()))
      if (records.some((entry) => entry.id === service.id))
        throw new Error(
          'Ya existe un servicio con ese ID. Abre el servicio existente.',
        )
      save({ id: service.id, venue: '', service })
      setSelectedId(service.id)
      setResult({
        message: 'Service 0.1 importado y guardado localmente.',
        ok: true,
      })
    } catch (cause) {
      setResult({
        message:
          cause instanceof Error
            ? cause.message
            : 'No se pudo abrir el archivo',
        ok: false,
      })
    }
    event.target.value = ''
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Desarrollo</p>
          <h1>Contract Inspector</h1>
          <p>Inspecciona, valida e intercambia Service 0.1 sin DevTools.</p>
        </div>
        <span className="offline-badge">Schema 0.1</span>
      </div>
      <div className="inspector-layout">
        <section className="panel form-stack">
          <label>
            Servicio
            <select
              value={record?.id ?? ''}
              onChange={(event) => {
                setSelectedId(event.target.value)
                setResult(null)
              }}
            >
              <option value="" disabled>
                Selecciona un servicio
              </option>
              {records.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.service.title || entry.id}
                </option>
              ))}
            </select>
          </label>
          {record ? (
            <>
              <p>
                <strong>{record.service.items.length}</strong> elementos ·{' '}
                <strong>{record.service.schemaVersion}</strong> ·{' '}
                {record.service.startsAt}
              </p>
              <div className="actions">
                <button className="button secondary" onClick={validate}>
                  Validar
                </button>
                <button className="button primary" onClick={download}>
                  Exportar Service 0.1
                </button>
              </div>
              <Link to="/services/$serviceId" params={{ serviceId: record.id }}>
                Abrir editor del servicio →
              </Link>
            </>
          ) : (
            <p>
              No hay servicios aún. <Link to="/services/new">Crea uno</Link> o
              abre un Service JSON.
            </p>
          )}
          <label className="file-label">
            Abrir archivo Service 0.1
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                void openFile(event)
              }}
            />
          </label>
          {result && (
            <p role="status" className={result.ok ? 'success' : 'error'}>
              {result.message}
            </p>
          )}
        </section>
        <section className="panel json-panel">
          <div className="section-heading">
            <h2>JSON</h2>
            <span>Campos exactos del contrato</span>
          </div>
          <pre>
            {record
              ? JSON.stringify(record.service, null, 2)
              : '{\n  "schemaVersion": "0.1"\n}'}
          </pre>
        </section>
      </div>
    </>
  )
}
