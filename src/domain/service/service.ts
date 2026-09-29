import { parseService, type Service } from '../../contracts/service'

export type ServiceRecord = { id: string; venue: string; service: Service }

export function newService(
  title: string,
  startsAt: string,
  venue: string,
): ServiceRecord {
  const id = crypto.randomUUID()
  return {
    id,
    venue,
    service: {
      schemaVersion: '0.1',
      id,
      title: title.trim(),
      startsAt,
      setlist: { id: `setlist-${id}`, name: title.trim() },
      items: [],
    },
  }
}

export function exportService(record: ServiceRecord): Service {
  return parseService(record.service)
}

export function localDateTime(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function downloadService(service: Service): void {
  const blob = new Blob([`${JSON.stringify(service, null, 2)}\n`], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${service.id}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
