// Generated from Service 0.1 worship contracts. Do not edit.

// src/contracts/worshipPlan.ts
function fail(path, message) {
  throw new Error(`${path}: ${message}`)
}
function object(value, path, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(path, 'expected an object')
  const result = value
  for (const key of Object.keys(result))
    if (!keys.includes(key)) fail(`${path}.${key}`, 'unknown field')
  return result
}
function nonEmpty(value, path) {
  if (typeof value !== 'string' || !value.trim())
    fail(path, 'expected non-empty text')
  return value
}
function parseWorshipContext(value) {
  const context = object(value, 'context', [
    'schemaVersion',
    'serviceId',
    'title',
    'startsAt',
    'setlistId',
    'name',
  ])
  if (context.schemaVersion !== '0.1')
    fail('context.schemaVersion', 'unsupported version; expected 0.1')
  for (const field of ['serviceId', 'title', 'startsAt', 'setlistId', 'name'])
    nonEmpty(context[field], `context.${field}`)
  if (Number.isNaN(Date.parse(context.startsAt)))
    fail('context.startsAt', 'invalid date')
  return value
}
function parseWorshipPlan(value) {
  const plan = object(value, 'worshipPlan', [
    'schemaVersion',
    'serviceId',
    'setlistId',
    'name',
    'songs',
  ])
  if (plan.schemaVersion !== '0.1')
    fail('worshipPlan.schemaVersion', 'unsupported version; expected 0.1')
  for (const field of ['serviceId', 'setlistId', 'name'])
    nonEmpty(plan[field], `worshipPlan.${field}`)
  if (!Array.isArray(plan.songs) || !plan.songs.length)
    fail('worshipPlan.songs', 'expected at least one song')
  plan.songs.forEach((rawSong, songIndex) => {
    const path = `worshipPlan.songs[${songIndex}]`
    const song = object(rawSong, path, [
      'songId',
      'title',
      'key',
      'arrangement',
      'sections',
    ])
    nonEmpty(song.songId, `${path}.songId`)
    nonEmpty(song.title, `${path}.title`)
    if (typeof song.key !== 'string') fail(`${path}.key`, 'expected text')
    if (
      !Array.isArray(song.arrangement) ||
      !song.arrangement.length ||
      song.arrangement.some((n) => !Number.isInteger(n) || n < 1)
    )
      fail(`${path}.arrangement`, 'expected positive section numbers')
    if (
      !Array.isArray(song.sections) ||
      song.sections.length !== song.arrangement.length
    )
      fail(`${path}.sections`, 'must match arrangement length')
    song.sections.forEach((rawSection, sectionIndex) => {
      const sectionPath = `${path}.sections[${sectionIndex}]`
      const section = object(rawSection, sectionPath, [
        'kind',
        'label',
        'lines',
      ])
      nonEmpty(section.kind, `${sectionPath}.kind`)
      nonEmpty(section.label, `${sectionPath}.label`)
      if (!Array.isArray(section.lines) || !section.lines.length)
        fail(`${sectionPath}.lines`, 'expected lines')
      section.lines.forEach((rawLine, lineIndex) => {
        const linePath = `${sectionPath}.lines[${lineIndex}]`
        const line = object(rawLine, linePath, ['text', 'chords'])
        const text = nonEmpty(line.text, `${linePath}.text`)
        if (!Array.isArray(line.chords))
          fail(`${linePath}.chords`, 'expected an array')
        line.chords.forEach((rawChord, chordIndex) => {
          const chordPath = `${linePath}.chords[${chordIndex}]`
          const chord = object(rawChord, chordPath, ['symbol', 'index'])
          nonEmpty(chord.symbol, `${chordPath}.symbol`)
          const index = chord.index
          if (
            !Number.isInteger(index) ||
            index < 0 ||
            index > text.length ||
            (index > 0 &&
              index < text.length &&
              /[\uD800-\uDBFF]/.test(text[index - 1]) &&
              /[\uDC00-\uDFFF]/.test(text[index]))
          )
            fail(`${chordPath}.index`, 'invalid UTF-16 offset')
        })
      })
    })
  })
  return value
}

// src/domain/service/worshipPlan.ts
function worshipContext(service) {
  return {
    schemaVersion: '0.1',
    serviceId: service.id,
    title: service.title,
    startsAt: service.startsAt,
    setlistId: service.setlist.id,
    name: service.setlist.name,
  }
}
function applyWorshipPlan(service, input, afterItemId) {
  const plan = parseWorshipPlan(input)
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
    throw new Error('El punto de inserci\xF3n del repertorio ya no existe.')
  const start = anchor + 1
  const occupied = new Set(withoutManaged.map((item) => item.id))
  const songs = plan.songs.map((song, index) => {
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
export {
  applyWorshipPlan,
  parseWorshipContext,
  parseWorshipPlan,
  worshipContext,
}
