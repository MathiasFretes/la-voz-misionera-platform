import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useServices } from '../features/services/useServices'
import { newService } from '../domain/service/service'

function nextSunday(): string {
  const date = new Date()
  date.setDate(date.getDate() + ((7 - date.getDay()) % 7))
  date.setHours(19, 0, 0, 0)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T19:00`
}

export function NewServicePage() {
  const [title, setTitle] = useState('Culto General')
  const [when, setWhen] = useState(nextSunday)
  const [venue, setVenue] = useState('Sede Central')
  const [error, setError] = useState('')
  const { save } = useServices()
  const navigate = useNavigate()

  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const record = newService(
        title,
        new Date(when).toISOString(),
        venue.trim(),
      )
      save(record)
      void navigate({
        to: '/services/$serviceId',
        params: { serviceId: record.id },
      })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo crear el servicio',
      )
    }
  }

  return (
    <div className="narrow-page">
      <Link to="/services" className="back-link">
        ← Servicios
      </Link>
      <p className="eyebrow">Nuevo servicio</p>
      <h1>Prepara un culto</h1>
      <form className="panel form-stack" onSubmit={submit}>
        <label>
          Nombre
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Fecha y hora
          <input
            type="datetime-local"
            required
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          />
        </label>
        <label>
          Sede
          <input
            value={venue}
            onChange={(event) => setVenue(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          <button className="button primary" type="submit">
            Crear servicio
          </button>
          <Link className="button secondary" to="/services">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
