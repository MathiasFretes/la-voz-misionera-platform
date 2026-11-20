const text = (key, label, required = false, type = 'text', value = '') => ({
  key,
  label,
  required,
  type,
  value,
})
export const contentCollections = [
  {
    id: 'eventos',
    label: 'Eventos',
    titleField: 'name',
    publicPath: '/calendario',
    fields: [
      text('name', 'Nombre', true),
      text('date', 'Fecha', true, 'date'),
      text('time', 'Hora', true, 'time'),
      text('day', 'Lugar', true),
      text('cat', 'Categoría', false, 'text', 'culto'),
      text('color', 'Color', false, 'color', '#1C2A39'),
    ],
  },
  {
    id: 'predicas',
    label: 'Prédicas',
    titleField: 'title',
    publicPath: '/predicas',
    fields: [
      text('title', 'Título', true),
      text('pastor', 'Predicador', true),
      text('serie', 'Serie'),
      text('date', 'Fecha', true, 'date'),
      text('dur', 'Duración'),
      text('videoUrl', 'Enlace al video', false, 'url'),
      text('audioUrl', 'Enlace al audio', false, 'url'),
    ],
  },
  {
    id: 'sedes',
    label: 'Sedes',
    titleField: 'name',
    publicPath: '/sedes',
    fields: [
      text('name', 'Nombre', true),
      text('address', 'Dirección', true),
      text('pastor', 'Responsable', true),
      text('phone', 'Teléfono'),
      text('email', 'Correo', false, 'email'),
      text('isCentral', 'Sede principal', false, 'boolean', false),
    ],
  },
  {
    id: 'pastores',
    label: 'Pastores',
    titleField: 'name',
    publicPath: '/pastores',
    fields: [
      text('name', 'Nombre', true),
      text('role', 'Función', true),
      text('bio', 'Biografía', false, 'textarea'),
      text('photoUrl', 'Enlace a la foto', false, 'url'),
      text('emoji', 'Símbolo'),
      text('color', 'Color', false, 'color', '#1C2A39'),
    ],
  },
  {
    id: 'ministerios',
    label: 'Ministerios',
    titleField: 'name',
    publicPath: '/ministerios',
    fields: [
      text('name', 'Nombre', true),
      text('lead', 'Responsable', true),
      text('desc', 'Descripción', true, 'textarea'),
      text('emoji', 'Símbolo'),
      text('color', 'Color', false, 'color', '#1C2A39'),
    ],
  },
  {
    id: 'serviceTimes',
    label: 'Horarios de culto',
    titleField: 'name',
    publicPath: '/',
    fields: [
      text('name', 'Nombre', true),
      text('day', 'Día', true),
      text('time', 'Hora', true, 'time'),
      text('description', 'Descripción', false, 'textarea'),
      text('location', 'Lugar', true),
      text('isActive', 'Activo', false, 'boolean', true),
    ],
  },
]

export function validateSiteDocument(input) {
  const schema = contentCollections.find(
    (collection) => collection.id === input?.p_collection,
  )
  if (
    !schema ||
    typeof input.p_id !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(input.p_id)
  )
    throw new Error('Contenido no reconocido')
  if (
    !Number.isSafeInteger(input.p_expected_revision) ||
    input.p_expected_revision < 0
  )
    throw new Error('Revisión no válida')
  if (!['save', 'publish', 'unpublish'].includes(input.p_action))
    throw new Error('Acción no válida')
  const data = input.p_data
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('El contenido debe ser un objeto')
  const fields = new Map(schema.fields.map((field) => [field.key, field]))
  for (const [key, value] of Object.entries(data)) {
    const field = fields.get(key)
    if (!field) throw new Error(`Campo no admitido: ${key}`)
    if (field.type === 'boolean') {
      if (typeof value !== 'boolean')
        throw new Error(`${field.label}: elegí sí o no`)
      continue
    }
    if (
      typeof value !== 'string' ||
      value.length > (field.type === 'textarea' ? 16000 : 2000)
    )
      throw new Error(`${field.label}: texto no válido`)
    if (!value) continue
    if (field.type === 'url') {
      let url
      try {
        url = new URL(value)
      } catch {
        throw new Error(`${field.label}: enlace no válido`)
      }
      if (
        !['https:', 'http:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error(`${field.label}: usá un enlace web sin credenciales`)
    }
    if (
      field.type === 'date' &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value)
    )
      throw new Error(`${field.label}: fecha no válida`)
    if (field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
      throw new Error(`${field.label}: hora no válida`)
    if (field.type === 'color' && !/^#[0-9a-fA-F]{6}$/.test(value))
      throw new Error('Color no válido')
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      throw new Error('Correo no válido')
  }
  if (input.p_action === 'publish')
    for (const field of schema.fields) {
      if (
        field.required &&
        (typeof data[field.key] !== 'string' || !data[field.key].trim())
      )
        throw new Error(
          `Completá ${field.label.toLowerCase()} antes de publicar`,
        )
    }
  return input
}
