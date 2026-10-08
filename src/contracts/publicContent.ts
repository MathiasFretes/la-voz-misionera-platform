// PublicContent 0.1: local, file-based preview between LVM Service and Web Pública.
// Keep this parser in sync with LVM Web Pública until a shared package exists.
export type PublicEvent = {
  id: string
  title: string
  date: string
  time: string
  venue: string
  kind: 'culto' | 'encuentro'
  description: string
}

export type PublicSermon = {
  id: string
  title: string
  series: string
  speaker: string
  date: string
  duration: string
  summary: string
}

export type PublicVenue = {
  id: string
  name: string
  zone: string
  address: string
  hours: string
  isMain: boolean
}

export type PublicContent = {
  schemaVersion: '0.1'
  generatedAt: string
  events: PublicEvent[]
  sermons: PublicSermon[]
  venues: PublicVenue[]
}

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`)
}

function object(
  value: unknown,
  path: string,
  keys: string[],
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(path, 'expected an object')
  const result = value as Record<string, unknown>
  for (const key of Object.keys(result))
    if (!keys.includes(key)) fail(`${path}.${key}`, 'unknown field')
  return result
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim())
    fail(path, 'expected non-empty text')
  return value
}

function date(value: unknown, path: string): void {
  const raw = text(value, path)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) fail(path, 'expected YYYY-MM-DD')
  const parsed = new Date(`${raw}T12:00:00Z`)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== raw
  )
    fail(path, 'invalid date')
}

function entries(
  value: unknown,
  path: string,
  keys: string[],
  check: (entry: Record<string, unknown>, path: string) => void,
): void {
  if (!Array.isArray(value)) fail(path, 'expected an array')
  const ids = new Set<string>()
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`
    const entry = object(item, itemPath, keys)
    const id = text(entry.id, `${itemPath}.id`)
    if (ids.has(id)) fail(`${itemPath}.id`, 'duplicate id')
    ids.add(id)
    check(entry, itemPath)
  })
}

export function parsePublicContent(value: unknown): PublicContent {
  const content = object(value, 'publicContent', [
    'schemaVersion',
    'generatedAt',
    'events',
    'sermons',
    'venues',
  ])
  if (content.schemaVersion !== '0.1')
    fail('publicContent.schemaVersion', 'unsupported version; expected 0.1')
  const generatedAt = text(content.generatedAt, 'publicContent.generatedAt')
  if (
    Number.isNaN(Date.parse(generatedAt)) ||
    new Date(generatedAt).toISOString() !== generatedAt
  )
    fail('publicContent.generatedAt', 'invalid timestamp')
  entries(
    content.events,
    'publicContent.events',
    ['id', 'title', 'date', 'time', 'venue', 'kind', 'description'],
    (event, path) => {
      for (const key of ['title', 'venue', 'description'])
        text(event[key], `${path}.${key}`)
      date(event.date, `${path}.date`)
      if (
        typeof event.time !== 'string' ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time)
      )
        fail(`${path}.time`, 'expected HH:mm')
      if (event.kind !== 'culto' && event.kind !== 'encuentro')
        fail(`${path}.kind`, 'expected culto or encuentro')
    },
  )
  entries(
    content.sermons,
    'publicContent.sermons',
    ['id', 'title', 'series', 'speaker', 'date', 'duration', 'summary'],
    (sermon, path) => {
      for (const key of ['title', 'series', 'speaker', 'duration', 'summary'])
        text(sermon[key], `${path}.${key}`)
      date(sermon.date, `${path}.date`)
    },
  )
  entries(
    content.venues,
    'publicContent.venues',
    ['id', 'name', 'zone', 'address', 'hours', 'isMain'],
    (venue, path) => {
      for (const key of ['name', 'zone', 'address', 'hours'])
        text(venue[key], `${path}.${key}`)
      if (typeof venue.isMain !== 'boolean')
        fail(`${path}.isMain`, 'expected boolean')
    },
  )
  return value as PublicContent
}
