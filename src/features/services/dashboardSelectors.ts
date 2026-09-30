import { parseService } from '../../contracts/service'
import type { ServiceRecord } from '../../domain/service/service'

export type DashboardStatus = {
  persistence: 'saved-local'
  worship: 'imported' | 'none'
  presenter: 'valid' | 'invalid'
}

function startTime(record: ServiceRecord): number | null {
  const value = Date.parse(record.service.startsAt)
  return Number.isFinite(value) ? value : null
}

export function selectDashboardServices(records: ServiceRecord[], now: Date) {
  const nowTime = now.getTime()
  const recent = [...records].sort((left, right) => {
    const leftTime = startTime(left)
    const rightTime = startTime(right)
    const leftUpcoming = leftTime !== null && leftTime >= nowTime
    const rightUpcoming = rightTime !== null && rightTime >= nowTime
    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1
    if (leftTime === null && rightTime === null)
      return left.id.localeCompare(right.id)
    if (leftTime === null || rightTime === null)
      return leftTime === null ? 1 : -1
    return (
      (leftUpcoming ? leftTime - rightTime : rightTime - leftTime) ||
      left.id.localeCompare(right.id)
    )
  })
  const upcoming = recent.find(
    (record) => (startTime(record) ?? -Infinity) >= nowTime,
  )

  return { upcoming, recent }
}

export function dashboardStatus(record: ServiceRecord): DashboardStatus {
  const prefix = `lvm-worship:${record.id}:`
  const worship =
    Array.isArray(record.service.items) &&
    record.service.items.some(
      (item) => typeof item?.id === 'string' && item.id.startsWith(prefix),
    )
      ? 'imported'
      : 'none'
  let presenter: DashboardStatus['presenter'] = 'invalid'
  try {
    parseService(record.service)
    presenter = 'valid'
  } catch {
    // Invalid saved drafts stay visible so the user can repair them.
  }

  return { persistence: 'saved-local', worship, presenter }
}
