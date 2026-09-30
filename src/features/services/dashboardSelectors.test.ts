import { describe, expect, it } from 'vitest'
import { demoService } from '../../fixtures/demoService'
import type { ServiceRecord } from '../../domain/service/service'
import { dashboardStatus, selectDashboardServices } from './dashboardSelectors'

function record(
  id: string,
  startsAt = '2026-10-04T19:00:00-03:00',
): ServiceRecord {
  const copy = structuredClone(demoService)
  copy.id = id
  copy.service.id = id
  copy.service.title = id
  copy.service.startsAt = startsAt
  return copy
}

describe('Dashboard selectors', () => {
  it('recognizes a valid prayer service without songs', () => {
    const prayer = record('oracion')
    prayer.service.items = prayer.service.items.filter(
      (item) => item.kind !== 'SONG',
    )

    expect(dashboardStatus(prayer)).toEqual({
      persistence: 'saved-local',
      worship: 'none',
      presenter: 'valid',
    })
  })

  it('uses ownership IDs for Worship, never the SONG kind alone', () => {
    const manual = record('manual')
    expect(dashboardStatus(manual).worship).toBe('none')

    const imported = record('imported')
    imported.service.items[1].id = 'lvm-worship:imported:1'
    expect(dashboardStatus(imported).worship).toBe('imported')
    expect(dashboardStatus(imported).presenter).toBe('valid')
  })

  it('uses parseService to reject an incomplete saved service', () => {
    const incomplete = record('incomplete')
    incomplete.service.items = []

    expect(dashboardStatus(incomplete).presenter).toBe('invalid')
  })

  it('selects the nearest future service and keeps all records reachable', () => {
    const past = record('past', '2026-09-29T19:00:00-03:00')
    const next = record('next', '2026-10-01T19:00:00-03:00')
    const later = record('later', '2026-10-08T19:00:00-03:00')
    const selection = selectDashboardServices(
      [next, past, later],
      new Date('2026-09-30T12:00:00-03:00'),
    )

    expect(selection.upcoming?.id).toBe('next')
    expect(selection.recent.map((item) => item.id)).toEqual([
      'next',
      'later',
      'past',
    ])
    expect(
      selectDashboardServices([past], new Date('2026-09-30T12:00:00-03:00'))
        .upcoming,
    ).toBeUndefined()
  })
})
