import { describe, expect, it } from 'vitest'
import { parsePublicContent } from './publicContent'

const valid = {
  schemaVersion: '0.1',
  generatedAt: '2026-10-07T15:00:00.000Z',
  events: [
    {
      id: 'one',
      title: 'Encuentro',
      date: '2026-10-17',
      time: '19:00',
      venue: 'Sede Central',
      kind: 'encuentro',
      description: 'Descripción',
    },
  ],
  sermons: [],
  venues: [],
}

describe('PublicContent 0.1', () => {
  it('accepts a preview with empty optional lists', () => {
    expect(parsePublicContent(valid).events[0].title).toBe('Encuentro')
  })
  it('rejects future versions, unknown fields and duplicate ids', () => {
    expect(() =>
      parsePublicContent({ ...valid, schemaVersion: '0.2' }),
    ).toThrow('schemaVersion')
    expect(() => parsePublicContent({ ...valid, published: true })).toThrow(
      'unknown field',
    )
    expect(() =>
      parsePublicContent({
        ...valid,
        events: [...valid.events, valid.events[0]],
      }),
    ).toThrow('duplicate id')
  })
  it('rejects impossible dates and invalid clock times', () => {
    expect(() =>
      parsePublicContent({
        ...valid,
        events: [{ ...valid.events[0], date: '2026-02-30' }],
      }),
    ).toThrow('invalid date')
    expect(() =>
      parsePublicContent({
        ...valid,
        events: [{ ...valid.events[0], time: '25:00' }],
      }),
    ).toThrow('HH:mm')
  })
})
