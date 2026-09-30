import { expect, test } from '@playwright/test'
import { demoService } from '../src/fixtures/demoService'
import type { ServiceRecord } from '../src/domain/service/service'

const storageKey = 'lvm.platform.services.v1'

function copy(id: string, title: string, dayOffset: number): ServiceRecord {
  const record = structuredClone(demoService)
  record.id = id
  record.service.id = id
  record.service.title = title
  record.service.startsAt = new Date(
    Date.now() + dayOffset * 86_400_000,
  ).toISOString()
  return record
}

test('shows repository services with independent, validated states', async ({
  page,
}) => {
  const next = copy('culto-general', 'Culto General', 1)
  next.service.items[1].id = 'lvm-worship:culto-general:1'
  const prayer = copy('oracion', 'Miércoles de oración', 3)
  prayer.service.items = prayer.service.items.filter(
    (item) => item.kind !== 'SONG',
  )
  const manual = copy('juvenil', 'Reunión juvenil', 5)
  manual.service.items = manual.service.items.filter(
    (item) => item.kind === 'SONG',
  )
  const invalid = copy('incompleto', 'Servicio incompleto', 7)
  invalid.service.items = []

  await page.addInitScript(
    ({ key, records }) => localStorage.setItem(key, JSON.stringify(records)),
    { key: storageKey, records: [next, prayer, manual, invalid] },
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/services')

  const hero = page.getByRole('region', { name: 'Culto General' })
  await expect(hero.getByText('Próximo servicio')).toBeVisible()
  await expect(hero.getByText('Repertorio importado')).toBeVisible()
  await expect(hero.getByText('Service válido')).toBeVisible()

  const prayerCard = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Miércoles de oración' }),
  })
  await expect(prayerCard.getByText('Guardado local')).toBeVisible()
  await expect(prayerCard.getByText('Sin repertorio')).toBeVisible()
  await expect(prayerCard.getByText('Service válido')).toBeVisible()

  const manualCard = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Reunión juvenil' }),
  })
  await expect(manualCard.getByText('Sin repertorio')).toBeVisible()
  const invalidCard = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Servicio incompleto' }),
  })
  await expect(invalidCard.getByText('Inválido')).toBeVisible()

  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      `horizontal overflow at ${width}px`,
    ).toBe(false)
  }

  await prayerCard.getByRole('link', { name: 'Abrir' }).click()
  await expect(
    page.getByRole('heading', { name: 'Miércoles de oración' }),
  ).toBeVisible()
})

test('shows empty and past-only collections without inventing an upcoming service', async ({
  page,
}) => {
  await page.goto('/services')
  await expect(
    page.getByRole('heading', { name: 'Organizá tu primer servicio' }),
  ).toBeVisible()

  const past = copy('anterior', 'Culto anterior', -1)
  await page.evaluate(
    ({ key, records }) => localStorage.setItem(key, JSON.stringify(records)),
    { key: storageKey, records: [past] },
  )
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Servicios recientes' }),
  ).toBeVisible()
  await expect(page.getByText('Próximo servicio')).toHaveCount(0)
  await expect(page.getByRole('article')).toHaveCount(1)
})
