import { useEffect, useState } from 'react'
import { serviceRepository } from '../../app/dependencies'
import type { ServiceRecord } from '../../domain/service/service'

export function useServices() {
  const [records, setRecords] = useState(() => serviceRepository.list())
  const [persistence, setPersistence] = useState(() =>
    serviceRepository.status(),
  )
  useEffect(() => {
    const unsubscribe = serviceRepository.subscribe(() => {
      setRecords(serviceRepository.list())
      setPersistence(serviceRepository.status())
    })
    void serviceRepository.ready()
    return unsubscribe
  }, [])

  return {
    records,
    persistence,
    retry: () => serviceRepository.retry(),
    migrationConflicts: () => serviceRepository.migrationConflicts(),
    save: (record: ServiceRecord) => serviceRepository.save(record),
    remove: (id: string) => serviceRepository.remove(id),
  }
}
