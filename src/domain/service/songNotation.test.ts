import { describe, expect, it } from 'vitest'
import { formatSongNotation, parseSongNotation } from './songNotation'

describe('song notation', () => {
  it('preserves repeated sections and UTF-16 chord placement', () => {
    const sections = parseSongNotation(
      '# Verso 1\n[G]Señor 😀 [D]aquí\n\n# Coro\n[C]Cantaré\n\n# Coro\n[C]Cantaré',
    )
    expect(sections.map((section) => section.label)).toEqual([
      'Verso 1',
      'Coro',
      'Coro',
    ])
    expect(sections[0].lines[0].chords[1].index).toBe(
      sections[0].lines[0].text.indexOf('aquí'),
    )
    expect(parseSongNotation(formatSongNotation(sections))).toEqual(sections)
  })
})
