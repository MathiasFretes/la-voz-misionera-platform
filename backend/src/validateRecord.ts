import { parseService } from '../../src/contracts/service'
import type { ServiceRecord } from '../../src/domain/service/service'

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function exactKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}

export function validateServiceRecord(value: unknown): ServiceRecord {
  if (
    !isObject(value) ||
    !exactKeys(value, ['id', 'venue', 'service', 'worshipAfterItemId'])
  ) {
    throw new Error('record: expected a ServiceRecord object')
  }
  if (!nonEmpty(value.id) || typeof value.venue !== 'string') {
    throw new Error('record.id and record.venue are required')
  }
  if (
    value.worshipAfterItemId !== undefined &&
    !nonEmpty(value.worshipAfterItemId)
  ) {
    throw new Error('record.worshipAfterItemId must be non-empty text')
  }
  if (!isObject(value.service)) throw new Error('record.service is required')
  const service = value.service
  if (service.id !== value.id)
    throw new Error('record.id must match service.id')

  if (Array.isArray(service.items) && service.items.length > 0) {
    parseService(service)
  } else {
    // The editor can save an empty draft; Service 0.1 export still requires an item.
    if (
      !exactKeys(service, [
        'schemaVersion',
        'id',
        'title',
        'startsAt',
        'setlist',
        'items',
      ]) ||
      service.schemaVersion !== '0.1' ||
      !nonEmpty(service.title) ||
      !Array.isArray(service.items) ||
      service.items.length !== 0 ||
      !nonEmpty(service.startsAt) ||
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(service.startsAt) ||
      Number.isNaN(Date.parse(service.startsAt)) ||
      !isObject(service.setlist) ||
      !exactKeys(service.setlist, ['id', 'name']) ||
      !nonEmpty(service.setlist.id) ||
      !nonEmpty(service.setlist.name)
    ) {
      throw new Error('record.service: invalid empty draft')
    }
  }
  return value as ServiceRecord
}
