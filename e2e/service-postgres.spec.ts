import { expect, test } from '@playwright/test'
import { parseService } from '../src/contracts/service'

test('creates a real service, survives an empty browser cache and exports Service 0.1', async ({
  page,
  request,
}) => {
  const title = `Culto PostgreSQL ${Date.now()}`
  let id = ''
  const writes: string[] = []
  page.on('response', (response) => {
    if (
      response.url().includes('/api/services/') &&
      response.request().method() === 'PUT'
    ) {
      void response
        .text()
        .then((body) => writes.push(`${response.status()} ${body}`))
        .catch(() => {})
    }
  })
  try {
    expect((await request.get('/api/services')).status()).toBe(200)
    await page.goto('/services/new')
    await page.getByLabel('Nombre').fill(title)
    await page.getByRole('button', { name: 'Crear servicio' }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    id = new URL(page.url()).pathname.split('/').at(-1) ?? ''
    expect(id).toBeTruthy()
    try {
      await expect(
        page.getByText('Servicios sincronizados con PostgreSQL.'),
      ).toBeVisible({ timeout: 10_000 })
    } catch (error) {
      throw new Error(`Service API writes: ${writes.join(' | ') || 'none'}`, {
        cause: error,
      })
    }
    expect((await request.get(`/api/services/${id}`)).status()).toBe(200)

    await page.getByRole('button', { name: /Agregar elemento/ }).click()
    await page.getByLabel('Tipo').selectOption('ANNOUNCEMENT')
    await page.getByLabel('Título', { exact: true }).fill('Bienvenida')
    await page
      .getByLabel('Texto', { exact: true })
      .fill('Bienvenidos al culto.')
    await page.getByRole('button', { name: 'Guardar elemento' }).click()
    await expect
      .poll(async () => {
        const response = await request.get(`/api/services/${id}`)
        if (!response.ok()) return -1
        const record = await response.json()
        return record.service.items.length as number
      })
      .toBe(1)
    await expect(
      page.getByText('Servicios sincronizados con PostgreSQL.'),
    ).toBeVisible()

    const response = await request.get(`/api/services/${id}`)
    expect(response.status()).toBe(200)
    const record = await response.json()
    expect(record.service.items).toHaveLength(1)
    expect(parseService(record.service).items[0].kind).toBe('ANNOUNCEMENT')

    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.locator('.order-item')).toHaveCount(1)
    await expect(
      page.getByText('Servicios sincronizados con PostgreSQL.'),
    ).toBeVisible()
  } finally {
    if (id) await request.delete(`/api/services/${id}`)
  }
})
