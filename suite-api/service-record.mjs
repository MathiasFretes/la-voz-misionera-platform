// Generated from backend/src/validateRecord.ts by npm run build:suite-api. Do not edit.

// src/contracts/service.ts
function fail(path, message) {
  throw new Error(`${path}: ${message}`)
}
function object(value, path, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(path, 'expected an object')
  const data = value
  for (const key of Object.keys(data))
    if (!keys.includes(key)) fail(`${path}.${key}`, 'unknown field')
  return data
}
function string(value, path) {
  if (typeof value !== 'string' || !value.trim())
    fail(path, 'expected non-empty text')
  return value
}
function chordIndex(text, index) {
  if (!Number.isInteger(index) || index < 0 || index > text.length) return false
  const offset = index
  if (offset > 0 && offset < text.length) {
    const before = text.charCodeAt(offset - 1)
    const after = text.charCodeAt(offset)
    if (before >= 55296 && before <= 56319 && after >= 56320 && after <= 57343)
      return false
  }
  return true
}
function parseService(value) {
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
  const ids = /* @__PURE__ */ new Set()
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
    const payload = /* @__PURE__ */ new Map([
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
      if (scripture.source !== void 0)
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
  return value
}

// backend/src/validateRecord.ts
function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}
function exactKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key))
}
function validateServiceRecord(value) {
  if (
    !isObject(value) ||
    !exactKeys(value, [
      'id',
      'venue',
      'service',
      'worshipAfterItemId',
      'revision',
    ])
  ) {
    throw new Error('record: expected a ServiceRecord object')
  }
  if (!nonEmpty(value.id) || typeof value.venue !== 'string') {
    throw new Error('record.id and record.venue are required')
  }
  if (
    value.worshipAfterItemId !== void 0 &&
    !nonEmpty(value.worshipAfterItemId)
  ) {
    throw new Error('record.worshipAfterItemId must be non-empty text')
  }
  if (
    value.revision !== void 0 &&
    (typeof value.revision !== 'number' ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 1)
  ) {
    throw new Error('record.revision must be a positive integer')
  }
  if (!isObject(value.service)) throw new Error('record.service is required')
  const service = value.service
  if (service.id !== value.id)
    throw new Error('record.id must match service.id')
  if (Array.isArray(service.items) && service.items.length > 0) {
    parseService(service)
  } else {
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
  return value
}
export { validateServiceRecord }
