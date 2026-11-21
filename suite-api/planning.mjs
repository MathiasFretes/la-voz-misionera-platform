import { validateServiceRecord } from './service-record.mjs'

export function planningPath(pathname) {
  const match =
    /^\/api\/churches\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/services(?:\/([^/]+))?$/.exec(
      pathname,
    )
  if (!match) return null
  try {
    return {
      church: match[1],
      id: match[2] ? decodeURIComponent(match[2]) : null,
    }
  } catch {
    throw Object.assign(new Error('Identificador inválido'), { status: 400 })
  }
}

export function planningCommand(method, route, input) {
  if (method === 'GET' && !route.id)
    return { name: 'list_service_plans', data: { p_church_id: route.church } }
  if (!route.id || !['PUT', 'DELETE'].includes(method))
    throw Object.assign(new Error('Method not allowed'), { status: 405 })
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw Object.assign(new Error('Datos de servicio inválidos'), {
      status: 400,
    })
  const deleted = method === 'DELETE'
  let record = null
  if (!deleted) {
    try {
      record = validateServiceRecord(input)
    } catch (error) {
      throw Object.assign(new Error(error.message), { status: 400 })
    }
    if (record.id !== route.id)
      throw Object.assign(new Error('El identificador no coincide'), {
        status: 400,
      })
  }
  const revision = input.revision ?? 0
  if (
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    (deleted && revision === 0)
  )
    throw Object.assign(new Error('Se requiere una revisión válida'), {
      status: 400,
    })
  return {
    name: 'save_service_plan',
    data: {
      p_church_id: route.church,
      p_id: route.id,
      p_record: record,
      p_expected_revision: revision,
      p_deleted: deleted,
    },
  }
}
