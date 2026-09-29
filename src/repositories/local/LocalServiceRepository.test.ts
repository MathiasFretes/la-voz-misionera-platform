import { beforeEach, describe, expect, it } from 'vitest'
import { demoService } from '../../fixtures/demoService'
import { LocalServiceRepository } from './LocalServiceRepository'

describe('LocalServiceRepository', () => {
  beforeEach(() => localStorage.clear())

  it('survives creating a new repository instance and preserves the order', () => {
    const first = new LocalServiceRepository(localStorage)
    first.save(demoService)
    const reopened = new LocalServiceRepository(localStorage)
    expect(
      reopened.get(demoService.id)?.service.items.map((item) => item.id),
    ).toEqual(demoService.service.items.map((item) => item.id))
    reopened.save({
      ...demoService,
      service: {
        ...demoService.service,
        items: [...demoService.service.items].reverse(),
      },
    })
    expect(
      new LocalServiceRepository(localStorage).get(demoService.id)?.service
        .items[0].id,
    ).toBe('sermon')
  })
})
