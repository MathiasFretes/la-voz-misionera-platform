import { expect, test } from '@playwright/test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parsePublicContent } from '../src/contracts/publicContent'

const demo = JSON.parse(
  await readFile(
    new URL('../fixtures/m79d-demo.json', import.meta.url),
    'utf8',
  ),
) as {
  venue: string
  service: { sermon: string }
  public: Record<string, string>
}

test.skip(
  process.env.LVM_PUBLIC_E2E !== '1',
  'Run with npm run test:public-preview',
)

test('Service content becomes a reviewable offline preview in Web Pública', async ({
  browser,
}) => {
  const folder = await mkdtemp(join(tmpdir(), 'lvm-public-preview-'))
  const demoCapture = process.env.LVM_DEMO_CAPTURE === '1'
  const captureDir = join(
    process.cwd(),
    'docs',
    'screenshots',
    demoCapture ? 'm79d' : 'm79c',
  )
  const capture = demoCapture || process.env.LVM_CAPTURE_VISUALS === '1'
  if (capture) await mkdir(captureDir, { recursive: true })
  const context = await browser.newContext({ acceptDownloads: true })
  await context.route(/https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort())
  try {
    const service = await context.newPage()
    await service.goto('http://127.0.0.1:4173/public-preview')
    await service.setViewportSize({ width: 390, height: 844 })
    if (capture)
      await service.screenshot({ path: join(captureDir, 'service-mobile.png') })
    expect(
      await service.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1)
    await service.setViewportSize({ width: 1280, height: 900 })
    const events = service.getByRole('region', { name: 'Eventos' })
    await events.getByLabel('Título').fill(demo.public.event)
    await events.getByLabel('Fecha').fill(demo.public.eventDate)
    await events.getByLabel('Hora').fill(demo.public.eventTime)
    await events.getByLabel('Sede').fill(demo.venue)
    await events.getByLabel('Descripción').fill(demo.public.eventDescription)
    const sermons = service.getByRole('region', { name: 'Prédicas' })
    await sermons.getByLabel('Título').fill(demo.service.sermon)
    await sermons.getByLabel('Resumen').fill(demo.public.sermonSummary)
    const venues = service.getByRole('region', { name: 'Sedes' })
    await venues.getByLabel('Nombre').fill(demo.venue)
    await venues.getByLabel('Zona').fill(demo.public.venueZone)
    await venues.getByLabel('Dirección').fill(demo.public.venueAddress)
    await venues.getByLabel('Horarios').fill(demo.public.venueHours)
    if (capture) {
      await service.evaluate(() => window.scrollTo(0, 0))
      await service.screenshot({
        path: join(captureDir, 'service-desktop.png'),
      })
    }
    const download = service.waitForEvent('download')
    await service
      .getByRole('button', { name: 'Descargar PublicContent 0.1' })
      .click()
    const file = join(folder, 'public-content.json')
    await (await download).saveAs(file)
    const content = parsePublicContent(JSON.parse(await readFile(file, 'utf8')))
    expect(content.events[0].title).toBe(demo.public.event)
    expect(content.events[0].venue).toBe(demo.venue)
    expect(content.sermons[0].title).toBe(demo.service.sermon)
    expect(content.venues[0].name).toBe(demo.venue)

    const [web] = await Promise.all([
      context.waitForEvent('page'),
      service.getByRole('link', { name: 'Abrir LVM Web Pública' }).click(),
    ])
    await web.waitForLoadState()
    expect(web.url()).toContain('127.0.0.1:4175/preview/import')
    const importUrl = web.url()
    await web.locator('input[type=file]').setInputFiles(file)
    await expect(
      web.getByRole('region', { name: 'Revisar contenido importado' }),
    ).toContainText(demo.public.event)
    if (capture) {
      await web.screenshot({ path: join(captureDir, 'web-import-desktop.png') })
      await web.setViewportSize({ width: 390, height: 844 })
      await web.screenshot({ path: join(captureDir, 'web-import-mobile.png') })
      await web.setViewportSize({ width: 1280, height: 900 })
    }
    await web.getByRole('button', { name: 'Aplicar a esta preview' }).click()
    await expect(web).toHaveURL(/\/eventos$/)
    if (capture)
      await web.screenshot({ path: join(captureDir, 'web-desktop.png') })
    await expect(
      web.getByRole('heading', { name: demo.public.event }),
    ).toBeVisible()
    await web.goto('http://127.0.0.1:4175/')
    await expect(
      web.getByRole('heading', { name: demo.public.event }),
    ).toBeVisible()
    await web.goto('http://127.0.0.1:4175/predicas')
    await expect(
      web.getByRole('heading', { name: demo.service.sermon }),
    ).toBeVisible()
    await web.goto('http://127.0.0.1:4175/sedes')
    await expect(
      web.getByRole('heading', { name: demo.venue }).first(),
    ).toBeVisible()
    await web.setViewportSize({ width: 390, height: 844 })
    await web.goto('http://127.0.0.1:4175/eventos')
    if (capture)
      await web.screenshot({ path: join(captureDir, 'web-mobile.png') })
    for (const route of [
      '/',
      '/eventos',
      '/predicas',
      '/sedes',
      '/preview/import',
    ]) {
      await web.goto(`http://127.0.0.1:4175${route}`)
      const overflow = await web.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      )
      expect(
        overflow,
        `${route} overflows with imported content`,
      ).toBeLessThanOrEqual(1)
    }
    await web.reload()
    await web.goto('http://127.0.0.1:4175/eventos')
    await expect(
      web.getByRole('heading', { name: demo.public.event }),
    ).toBeVisible()

    await web.goto(importUrl)
    const future = join(folder, 'future.json')
    await writeFile(
      future,
      JSON.stringify({ ...content, schemaVersion: '0.2' }),
    )
    await web.locator('input[type=file]').setInputFiles(future)
    await expect(web.getByRole('alert')).toContainText('unsupported version')
    await expect(
      web.getByText('Origen actual: archivo importado'),
    ).toBeVisible()
    await web
      .getByRole('button', { name: 'Restaurar fixtures de demostración' })
      .click()
    await web.goto('http://127.0.0.1:4175/eventos')
    await expect(
      web.getByRole('heading', { name: demo.public.event }),
    ).toHaveCount(0)

    await web.goto(importUrl)
    await web.getByRole('link', { name: 'Volver a LVM Service' }).click()
    await expect(web).toHaveURL(/127\.0\.0\.1:4173\/public-preview$/)
    await expect(
      web.getByRole('region', { name: 'Eventos' }).getByLabel('Título'),
    ).toHaveValue(demo.public.event)
  } finally {
    await context.close()
    await rm(folder, { recursive: true, force: true })
  }
})
