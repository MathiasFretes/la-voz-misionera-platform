import { expect, test } from '@playwright/test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parsePublicContent } from '../src/contracts/publicContent'

test.skip(
  process.env.LVM_PUBLIC_E2E !== '1',
  'Run with npm run test:public-preview',
)

test('Service content becomes a reviewable offline preview in Web Pública', async ({
  browser,
}) => {
  const folder = await mkdtemp(join(tmpdir(), 'lvm-public-preview-'))
  const captureDir = join(process.cwd(), 'docs', 'screenshots', 'm79c')
  const capture = process.env.LVM_CAPTURE_VISUALS === '1'
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
    await events.getByLabel('Título').fill('Encuentro Juvenil M79C')
    await events
      .getByLabel('Descripción')
      .fill('Una reunión preparada en LVM Service y revisada en Web Pública.')
    if (capture) {
      await service.evaluate(() => window.scrollTo(0, 0))
      await service.screenshot({ path: join(captureDir, 'service-desktop.png') })
    }
    const download = service.waitForEvent('download')
    await service
      .getByRole('button', { name: 'Descargar PublicContent 0.1' })
      .click()
    const file = join(folder, 'public-content.json')
    await (await download).saveAs(file)
    const content = parsePublicContent(JSON.parse(await readFile(file, 'utf8')))
    expect(content.events[0].title).toBe('Encuentro Juvenil M79C')

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
    ).toContainText('Encuentro Juvenil M79C')
    if (capture) {
      await web.screenshot({ path: join(captureDir, 'web-import-desktop.png') })
      await web.setViewportSize({ width: 390, height: 844 })
      await web.screenshot({ path: join(captureDir, 'web-import-mobile.png') })
      await web.setViewportSize({ width: 1280, height: 900 })
    }
    await web.getByRole('button', { name: 'Aplicar a esta preview' }).click()
    await expect(web).toHaveURL(/\/eventos$/)
    if (capture) await web.screenshot({ path: join(captureDir, 'web-desktop.png') })
    await expect(
      web.getByRole('heading', { name: 'Encuentro Juvenil M79C' }),
    ).toBeVisible()
    await web.goto('http://127.0.0.1:4175/')
    await expect(
      web.getByRole('heading', { name: 'Encuentro Juvenil M79C' }),
    ).toBeVisible()
    await web.goto('http://127.0.0.1:4175/predicas')
    await expect(
      web.getByRole('heading', { name: 'Viviendo por fe · ejemplo' }),
    ).toBeVisible()
    await web.goto('http://127.0.0.1:4175/sedes')
    await expect(
      web.getByRole('heading', { name: 'Sede de ejemplo' }).first(),
    ).toBeVisible()
    await web.setViewportSize({ width: 390, height: 844 })
    await web.goto('http://127.0.0.1:4175/eventos')
    if (capture) await web.screenshot({ path: join(captureDir, 'web-mobile.png') })
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
      web.getByRole('heading', { name: 'Encuentro Juvenil M79C' }),
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
      web.getByRole('heading', { name: 'Encuentro Juvenil M79C' }),
    ).toHaveCount(0)

    await web.goto(importUrl)
    await web.getByRole('link', { name: 'Volver a LVM Service' }).click()
    await expect(web).toHaveURL(/127\.0\.0\.1:4173\/public-preview$/)
    await expect(
      web.getByRole('region', { name: 'Eventos' }).getByLabel('Título'),
    ).toHaveValue('Encuentro Juvenil M79C')
  } finally {
    await context.close()
    await rm(folder, { recursive: true, force: true })
  }
})
