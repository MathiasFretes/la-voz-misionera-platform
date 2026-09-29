export type Chord = { symbol: string; index: number }
export type SongLine = { text: string; chords: Chord[] }
export type SongSection = { kind: string; label: string; lines: SongLine[] }
export type Song = {
  id: string
  title: string
  key: string
  sections: SongSection[]
}
export type ServiceItem =
  | { id: string; kind: 'SONG'; song: Song }
  | {
      id: string
      kind: 'SCRIPTURE'
      scripture: {
        reference: string
        version: string
        text: string
        source?: string
      }
    }
  | {
      id: string
      kind: 'ANNOUNCEMENT'
      announcement: { title: string; body: string }
    }
  | { id: string; kind: 'SERMON'; sermon: { title: string; body: string } }

export type Service = {
  schemaVersion: '0.1'
  id: string
  title: string
  startsAt: string
  setlist: { id: string; name: string }
  items: ServiceItem[]
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
  const data = value as Record<string, unknown>
  for (const key of Object.keys(data))
    if (!keys.includes(key)) fail(`${path}.${key}`, 'unknown field')
  return data
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim())
    fail(path, 'expected non-empty text')
  return value
}

function chordIndex(text: string, index: unknown): boolean {
  if (
    !Number.isInteger(index) ||
    (index as number) < 0 ||
    (index as number) > text.length
  )
    return false
  const offset = index as number
  if (offset > 0 && offset < text.length) {
    const before = text.charCodeAt(offset - 1)
    const after = text.charCodeAt(offset)
    if (
      before >= 0xd800 &&
      before <= 0xdbff &&
      after >= 0xdc00 &&
      after <= 0xdfff
    )
      return false
  }
  return true
}

export function parseService(value: unknown): Service {
  const service = object(value, 'service', [
    'schemaVersion',
    'id',
    'title',
    'startsAt',
    'setlist',
    'items',
  ])
  if (service.schemaVersion !== '0.1')
    fail(
      'service.schemaVersion',
      `unsupported version ${String(service.schemaVersion)}; expected 0.1`,
    )
  string(service.id, 'service.id')
  string(service.title, 'service.title')
  const startsAt = string(service.startsAt, 'service.startsAt')
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(startsAt) ||
    Number.isNaN(Date.parse(startsAt))
  ) {
    fail('service.startsAt', 'expected an ISO 8601 date and time with timezone')
  }
  const setlist = object(service.setlist, 'service.setlist', ['id', 'name'])
  string(setlist.id, 'service.setlist.id')
  string(setlist.name, 'service.setlist.name')
  if (!Array.isArray(service.items) || !service.items.length)
    fail('service.items', 'expected at least one item')
  const ids = new Set<string>()
  service.items.forEach((rawItem, index) => {
    const path = `service.items[${index}]`
    const item = object(rawItem, path, [
      'id',
      'kind',
      'song',
      'scripture',
      'announcement',
      'sermon',
    ])
    const id = string(item.id, `${path}.id`)
    if (ids.has(id)) fail(`${path}.id`, `duplicate id ${id}`)
    ids.add(id)
    const payload = new Map([
      ['SONG', 'song'],
      ['SCRIPTURE', 'scripture'],
      ['ANNOUNCEMENT', 'announcement'],
      ['SERMON', 'sermon'],
    ]).get(String(item.kind))
    if (!payload) fail(`${path}.kind`, `unsupported kind ${String(item.kind)}`)
    for (const key of ['song', 'scripture', 'announcement', 'sermon']) {
      if (key !== payload && key in item)
        fail(`${path}.${key}`, 'payload does not match kind')
    }
    if (item.kind === 'SONG') {
      const song = object(item.song, `${path}.song`, [
        'id',
        'title',
        'key',
        'sections',
      ])
      string(song.id, `${path}.song.id`)
      string(song.title, `${path}.song.title`)
      if (typeof song.key !== 'string')
        fail(`${path}.song.key`, 'expected text')
      if (!Array.isArray(song.sections) || !song.sections.length)
        fail(`${path}.song.sections`, 'expected at least one section')
      song.sections.forEach((rawSection, sectionIndex) => {
        const sectionPath = `${path}.song.sections[${sectionIndex}]`
        const section = object(rawSection, sectionPath, [
          'kind',
          'label',
          'lines',
        ])
        string(section.kind, `${sectionPath}.kind`)
        string(section.label, `${sectionPath}.label`)
        if (!Array.isArray(section.lines) || !section.lines.length)
          fail(`${sectionPath}.lines`, 'expected at least one line')
        section.lines.forEach((rawLine, lineIndex) => {
          const linePath = `${sectionPath}.lines[${lineIndex}]`
          const line = object(rawLine, linePath, ['text', 'chords'])
          const text = string(line.text, `${linePath}.text`)
          if (!Array.isArray(line.chords))
            fail(`${linePath}.chords`, 'expected an array')
          line.chords.forEach((rawChord, chordIndexNumber) => {
            const chordPath = `${linePath}.chords[${chordIndexNumber}]`
            const chord = object(rawChord, chordPath, ['symbol', 'index'])
            string(chord.symbol, `${chordPath}.symbol`)
            if (!chordIndex(text, chord.index))
              fail(
                `${chordPath}.index`,
                'invalid UTF-16 offset or split surrogate pair',
              )
          })
        })
      })
    } else if (item.kind === 'SCRIPTURE') {
      const scripture = object(item.scripture, `${path}.scripture`, [
        'reference',
        'version',
        'text',
        'source',
      ])
      for (const key of ['reference', 'version', 'text'])
        string(scripture[key], `${path}.scripture.${key}`)
      if (scripture.source !== undefined)
        string(scripture.source, `${path}.scripture.source`)
    } else {
      const content = object(item[payload], `${path}.${payload}`, [
        'title',
        'body',
      ])
      string(content.title, `${path}.${payload}.title`)
      string(content.body, `${path}.${payload}.body`)
    }
  })
  return value as Service
}
