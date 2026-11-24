import { parseWorshipPlan } from './worship-contract.mjs'

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
export function worshipPath(pathname) {
  const match =
    /^\/api\/churches\/([^/]+)\/services\/([^/]+)\/worship(?:\/(apply))?$/.exec(
      pathname,
    )
  if (!match || !uuid.test(match[1])) return null
  try {
    return {
      church: match[1],
      id: decodeURIComponent(match[2]),
      apply: !!match[3],
    }
  } catch {
    throw Object.assign(new Error('Identificador inválido'), { status: 400 })
  }
}
export function worshipCommand(method, route, input, operationId) {
  const bad = (message, status = 400) => {
    throw Object.assign(new Error(message), { status })
  }
  if (method === 'GET' && !route.apply)
    return {
      name: 'get_worship_exchange',
      data: { p_church_id: route.church, p_service_id: route.id },
    }
  if (method !== (route.apply ? 'POST' : 'PUT')) bad('Method not allowed', 405)
  if (!uuid.test(operationId || ''))
    bad('Se requiere un identificador de operación')
  if (!input || typeof input !== 'object' || Array.isArray(input))
    bad('Datos musicales inválidos')
  const allowed = route.apply
    ? ['revision', 'serviceRevision']
    : ['plan', 'revision', 'serviceRevision']
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    bad('Campos musicales no admitidos')
  if (
    !Number.isSafeInteger(input.revision) ||
    input.revision < (route.apply ? 1 : 0) ||
    !Number.isSafeInteger(input.serviceRevision) ||
    input.serviceRevision < 1
  )
    bad('Revisión musical inválida')
  const data = {
    p_church_id: route.church,
    p_service_id: route.id,
    p_service_revision: input.serviceRevision,
    p_operation_id: operationId,
  }
  if (route.apply)
    return {
      name: 'apply_worship_plan',
      data: { ...data, p_plan_revision: input.revision },
    }
  let plan
  try {
    plan = parseWorshipPlan(input.plan)
  } catch (error) {
    bad(error.message)
  }
  if (
    plan.serviceId !== route.id ||
    plan.songs.length > 500 ||
    JSON.stringify(plan).length > 200000
  )
    bad('El repertorio no corresponde al culto o excede el tamaño permitido')
  return {
    name: 'save_worship_plan',
    data: { ...data, p_expected_revision: input.revision, p_plan: plan },
  }
}
