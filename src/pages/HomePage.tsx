import { Link } from '@tanstack/react-router'

export function HomePage() {
  return (
    <section className="hero">
      <p className="eyebrow">Planificación del culto</p>
      <h1>Un servicio listo para preparar y presentar.</h1>
      <p>
        Crea el orden del culto, guarda los cambios en este navegador y exporta
        un Service 0.1 que LVM Presenter puede abrir sin conexión.
      </p>
      <div className="actions">
        <Link className="button primary" to="/services/new">
          Crear servicio
        </Link>
        <Link className="button secondary" to="/services">
          Ver servicios
        </Link>
      </div>
    </section>
  )
}
