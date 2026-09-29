import { useEffect, useState } from 'react'
import { serviceRepository } from '../../app/dependencies'
import type { ServiceRecord } from '../../domain/service/service'

export function useServices() {
  const [records, setRecords] = useState(() => serviceRepository.list())
  useEffect(
    () =>
      serviceRepository.subscribe(() => setRecords(serviceRepository.list())),
    [],
  )

  return {
    records,
    save: (record: ServiceRecord) => serviceRepository.save(record),
    remove: (id: string) => serviceRepository.remove(id),
  }
}
