import type { SongLine, SongSection } from '../../contracts/service'

function parseLine(raw: string): SongLine {
  let text = ''
  const chords: SongLine['chords'] = []
  for (let i = 0; i < raw.length;) {
    if (raw[i] === '[') {
      const end = raw.indexOf(']', i + 1)
      if (end > i + 1) {
        chords.push({ symbol: raw.slice(i + 1, end), index: text.length })
        i = end + 1
        continue
      }
    }
    text += raw[i]
    i += 1
  }
  if (!text.trim()) throw new Error('Cada línea de canción necesita letra')
  return { text, chords }
}

export function parseSongNotation(source: string): SongSection[] {
  const sections: SongSection[] = []
  let label = 'Verso 1'
  let lines: SongLine[] = []
  const flush = () => {
    if (!lines.length) return
    const lower = label.toLocaleLowerCase('es')
    const kind = lower.startsWith('coro')
      ? 'chorus'
      : lower.startsWith('puente')
        ? 'bridge'
        : 'verse'
    sections.push({ kind, label, lines })
    lines = []
  }
  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    if (raw.startsWith('# ')) {
      flush()
      label = raw.slice(2).trim()
      if (!label) throw new Error('Cada sección necesita un nombre')
    } else if (raw.trim()) {
      lines.push(parseLine(raw))
    } else {
      flush()
      label = `Verso ${sections.length + 1}`
    }
  }
  flush()
  if (!sections.length)
    throw new Error('La canción necesita al menos una sección con letra')
  return sections
}

export function formatSongNotation(sections: SongSection[]): string {
  return sections
    .map((section) => {
      const lines = section.lines.map((line) => {
        let text = line.text
        const sorted = line.chords
          .map((chord, index) => ({ ...chord, order: index }))
          .sort((a, b) => b.index - a.index || b.order - a.order)
        for (const chord of sorted)
          text = `${text.slice(0, chord.index)}[${chord.symbol}]${text.slice(chord.index)}`
        return text
      })
      return [`# ${section.label}`, ...lines].join('\n')
    })
    .join('\n\n')
}
