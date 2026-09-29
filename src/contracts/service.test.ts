import { describe, expect, it } from 'vitest'
import { demoService } from '../fixtures/demoService'
import { parseService } from './service'

describe('Service 0.1', () => {
  it('accepts a complete local service with the required item kinds', () => {
    const service = parseService(demoService.service)
    expect(service.items.map((item) => item.kind)).toEqual([
      'ANNOUNCEMENT',
      'SONG',
      'SONG',
      'SCRIPTURE',
      'ANNOUNCEMENT',
      'SERMON',
    ])
    expect(
      service.items[3].kind === 'SCRIPTURE' && service.items[3].scripture.text,
    ).toContain('amó Dios')
  })

  it('rejects future versions and partial or malformed items', () => {
    const future = structuredClone(demoService.service) as unknown as Record<
      string,
      unknown
    >
    future.schemaVersion = '0.2'
    expect(() => parseService(future)).toThrow('service.schemaVersion')
    const broken = structuredClone(demoService.service)
    broken.items[0].id = broken.items[1].id
    expect(() => parseService(broken)).toThrow('duplicate id')
    const extra = structuredClone(demoService.service) as unknown as Record<
      string,
      unknown
    >
    extra.freeShowLayout = '1920x1080'
    expect(() => parseService(extra)).toThrow('unknown field')
  })

  it('uses UTF-16 chord offsets without splitting an emoji', () => {
    const service = structuredClone(demoService.service)
    const song = service.items.find((item) => item.kind === 'SONG')
    if (!song || song.kind !== 'SONG') throw new Error('fixture song missing')
    song.song.sections[0].lines[0] = {
      text: 'Fe 😀 aquí',
      chords: [{ symbol: 'G', index: 6 }],
    }
    expect(parseService(service).items).toHaveLength(6)
    song.song.sections[0].lines[0].chords[0].index = 4
    expect(() => parseService(service)).toThrow('split surrogate pair')
  })
})
