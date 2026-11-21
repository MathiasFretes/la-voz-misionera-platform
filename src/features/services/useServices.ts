import { useEffect, useState } from 'react'
import { serviceRepository } from '../../app/dependencies'
import { usePlanning } from './PlanningContext'
import type { ServiceRecord } from '../../domain/service/service'

export function useServices() {
  const planning = usePlanning()
  const repository = planning?.repository || serviceRepository
  const [records, setRecords] = useState(() => repository.list())
  const [persistence, setPersistence] = useState(() => repository.status())
  useEffect(() => {
    const unsubscribe = repository.subscribe(() => {
      setRecords(repository.list())
      setPersistence(repository.status())
    })
    void repository.ready()
    return unsubscribe
  }, [repository])

  return {
    records,
    persistence,
    retry: () => repository.retry(),
    migrationConflicts: () => repository.migrationConflicts(),
    save: (record: ServiceRecord) => repository.save(record),
    remove: (id: string) => repository.remove(id),
  }
}
