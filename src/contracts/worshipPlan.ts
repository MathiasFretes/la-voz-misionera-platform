import type { SongSection } from './service'

export type WorshipContext = {
  schemaVersion: '0.1'
  serviceId: string
  title: string
  startsAt: string
  setlistId: string
  name: string
}

export type WorshipPlan = {
  schemaVersion: '0.1'
  serviceId: string
  setlistId: string
  name: string
  songs: {
    songId: string
    title: string
    key: string
    arrangement: number[]
    sections: SongSection[]
  }[]
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

function nonEmpty(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim())
    fail(path, 'expected non-empty text')
  return value
}

export function parseWorshipContext(value: unknown): WorshipContext {
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
  if (Number.isNaN(Date.parse(context.startsAt as string)))
    fail('context.startsAt', 'invalid date')
  return value as WorshipContext
}

export function parseWorshipPlan(value: unknown): WorshipPlan {
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
            (index as number) < 0 ||
            (index as number) > text.length ||
            ((index as number) > 0 &&
              (index as number) < text.length &&
              /[\uD800-\uDBFF]/.test(text[(index as number) - 1]) &&
              /[\uDC00-\uDFFF]/.test(text[index as number]))
          )
            fail(`${chordPath}.index`, 'invalid UTF-16 offset')
        })
      })
    })
  })
  return value as WorshipPlan
}
