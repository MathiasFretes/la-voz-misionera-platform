import { describe, expect, it } from 'vitest'
import type { Service } from '../../contracts/service'
import { parseWorshipPlan } from '../../contracts/worshipPlan'
import { applyWorshipPlan, worshipContext } from './worshipPlan'

const section = {
  kind: 'CHORUS',
  label: 'Coro',
  lines: [{ text: 'Señor, eres fiel', chords: [{ symbol: 'G', index: 0 }] }],
}
const announcement = {
  id: 'welcome',
  kind: 'ANNOUNCEMENT' as const,
  announcement: { title: 'Bienvenida', body: 'Bienvenidos' },
}
const scripture = {
  id: 'bible',
  kind: 'SCRIPTURE' as const,
  scripture: {
    reference: 'Juan 3:16',
    version: 'RVR1960',
    text: 'Porque de tal manera...',
  },
}
const sermon = {
  id: 'sermon',
  kind: 'SERMON' as const,
  sermon: { title: 'Mensaje', body: 'Esperanza' },
}
const oldSong = (id: string) => ({
  id,
  kind: 'SONG' as const,
  song: { id: 'old', title: 'Anterior', key: 'C', sections: [section] },
})
const service: Service = {
  schemaVersion: '0.1',
  id: 'culto-1',
  title: 'Culto',
  startsAt: '2026-10-04T19:00:00Z',
  setlist: { id: 'old-set', name: 'Anterior' },
  items: [
    announcement,
    oldSong('a'),
    oldSong('b'),
    scripture,
    sermon,
    oldSong('closing'),
  ],
}
const plan = {
  schemaVersion: '0.1',
  serviceId: 'culto-1',
  setlistId: 'set-1',
  name: 'Adoración',
  songs: [
    {
      songId: 'same',
      title: 'Santo',
      key: 'G',
      arrangement: [1, 1],
      sections: [section, section],
    },
    {
      songId: 'same',
      title: 'Santo',
      key: 'D',
      arrangement: [1],
      sections: [section],
    },
    {
      songId: 'third',
      title: 'Fiel',
      key: 'A',
      arrangement: [1],
      sections: [section],
    },
  ],
}

describe('WorshipPlan 0.1', () => {
  it('exports only service context for Worship', () => {
    expect(worshipContext(service)).toEqual({
      schemaVersion: '0.1',
      serviceId: 'culto-1',
      title: 'Culto',
      startsAt: service.startsAt,
      setlistId: 'old-set',
      name: 'Anterior',
    })
  })

  it('inserts Worship songs while preserving every manual service item', () => {
    const merged = applyWorshipPlan(service, plan, 'welcome')
    expect(merged.items.map((item) => item.kind)).toEqual([
      'ANNOUNCEMENT',
      'SONG',
      'SONG',
      'SONG',
      'SONG',
      'SONG',
      'SCRIPTURE',
      'SERMON',
      'SONG',
    ])
    expect(merged.items[0]).toEqual(announcement)
    expect(merged.items.slice(4)).toEqual([
      oldSong('a'),
      oldSong('b'),
      scripture,
      sermon,
      oldSong('closing'),
    ])
    expect(merged.items.slice(1, 4).map((item) => item.id)).toEqual([
      'lvm-worship:culto-1:1',
      'lvm-worship:culto-1:2',
      'lvm-worship:culto-1:3',
    ])
    expect(merged.items[1]).toMatchObject({
      song: { id: 'same', key: 'G', sections: [section, section] },
    })
    expect(merged.items[2]).toMatchObject({ song: { id: 'same', key: 'D' } })
    expect(merged.setlist).toEqual({ id: 'set-1', name: 'Adoración' })
    expect(applyWorshipPlan(merged, plan, 'welcome')).toEqual(merged)
  })

  it('keeps a manual song next to the anchor when replacing an earlier Worship import', () => {
    const withManualSong = {
      ...service,
      items: [announcement, oldSong('special'), scripture],
    }
    const first = applyWorshipPlan(withManualSong, plan, 'welcome')
    expect(first.items.map((item) => item.id)).toEqual([
      'welcome',
      'lvm-worship:culto-1:1',
      'lvm-worship:culto-1:2',
      'lvm-worship:culto-1:3',
      'special',
      'bible',
    ])

    const changedPlan = { ...plan, songs: plan.songs.slice(1) }
    const second = applyWorshipPlan(first, changedPlan, 'welcome')
    expect(second.items.map((item) => item.id)).toEqual([
      'welcome',
      'lvm-worship:culto-1:1',
      'lvm-worship:culto-1:2',
      'special',
      'bible',
    ])
    expect(second.items.slice(3)).toEqual([oldSong('special'), scripture])
    expect(second.items[1]).toMatchObject({ song: { id: 'same', key: 'D' } })
    expect(second.items[2]).toMatchObject({ song: { id: 'third', key: 'A' } })
  })

  it('rejects a different service and corrupt plans without mutating input', () => {
    const before = structuredClone(service)
    expect(() =>
      applyWorshipPlan(service, { ...plan, serviceId: 'other' }, 'welcome'),
    ).toThrow(/otro culto/)
    expect(() => parseWorshipPlan({ ...plan, schemaVersion: '0.2' })).toThrow(
      /schemaVersion/,
    )
    expect(() =>
      applyWorshipPlan(
        service,
        { ...plan, songs: [{ ...plan.songs[0], sections: [] }] },
        'welcome',
      ),
    ).toThrow(/sections/)
    expect(service).toEqual(before)
  })

  it('inserts after the chosen item when there is no prior music and rejects missing anchors', () => {
    const emptyMusic = { ...service, items: [announcement, scripture, sermon] }
    expect(applyWorshipPlan(emptyMusic, plan, 'welcome').items[1].kind).toBe(
      'SONG',
    )
    expect(() => applyWorshipPlan(emptyMusic, plan, 'deleted')).toThrow(
      /punto de inserción/,
    )
  })
})
