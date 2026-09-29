import {
  parseWorshipPlan,
  type WorshipContext,
  type WorshipPlan,
} from '../../contracts/worshipPlan'
import type { Service, ServiceItem } from '../../contracts/service'

export function worshipContext(service: Service): WorshipContext {
  return {
    schemaVersion: '0.1',
    serviceId: service.id,
    title: service.title,
    startsAt: service.startsAt,
    setlistId: service.setlist.id,
    name: service.setlist.name,
  }
}

export function applyWorshipPlan(
  service: Service,
  input: unknown,
  afterItemId?: string,
): Service {
  const plan: WorshipPlan = parseWorshipPlan(input)
  if (service.id !== plan.serviceId)
    throw new Error(`El repertorio pertenece a otro culto (${plan.serviceId}).`)
  const prefix = `lvm-worship:${service.id}:`
  const withoutManaged = service.items.filter(
    (item) => !item.id.startsWith(prefix),
  )
  const anchor = afterItemId
    ? withoutManaged.findIndex((item) => item.id === afterItemId)
    : -1
  if (afterItemId && anchor < 0)
    throw new Error('El punto de inserción del repertorio ya no existe.')
  const start = anchor + 1
  const occupied = new Set(withoutManaged.map((item) => item.id))
  const songs: ServiceItem[] = plan.songs.map((song, index) => {
    const base = `${prefix}${index + 1}`
    let id = base
    for (let suffix = 2; occupied.has(id); suffix += 1) id = `${base}:${suffix}`
    occupied.add(id)
    return {
      id,
      kind: 'SONG',
      song: {
        id: song.songId,
        title: song.title,
        key: song.key,
        sections: song.sections,
      },
    }
  })
  return {
    ...service,
    setlist: { id: plan.setlistId, name: plan.name },
    items: [
      ...withoutManaged.slice(0, start),
      ...songs,
      ...withoutManaged.slice(start),
    ],
  }
}
