import type { ServiceRepository } from '../repositories/ServiceRepository'
import { LocalServiceRepository } from '../repositories/local/LocalServiceRepository'

export const serviceRepository: ServiceRepository = new LocalServiceRepository(
  window.localStorage,
)
