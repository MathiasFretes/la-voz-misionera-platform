import type { ServiceRepository } from '../repositories/ServiceRepository'
import { ApiServiceRepository } from '../repositories/api/ApiServiceRepository'
import { LocalServiceRepository } from '../repositories/local/LocalServiceRepository'

export const serviceRepository: ServiceRepository =
  import.meta.env.VITE_SERVICE_BACKEND === 'postgres'
    ? new ApiServiceRepository(window.localStorage)
    : new LocalServiceRepository(window.localStorage)
