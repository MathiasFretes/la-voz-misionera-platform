import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseService } from '../src/contracts/service'
import {
  parseWorshipContext,
  type WorshipPlan,
} from '../src/contracts/worshipPlan'

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

    const contextDownload = page.waitForEvent('download')
    await page
      .getByRole('button', { name: '1. Descargar contexto para Worship' })
      .click()
    const context = parseWorshipContext(
      JSON.parse(await readFile(await (await contextDownload).path(), 'utf8')),
    )
    expect(context.serviceId).toBe(id)
    const chorus = {
      kind: 'CHORUS',
      label: 'Coro',
      lines: [
        {
          text: 'Cantamos con fe y alegría',
          chords: [{ symbol: 'G', index: 0 }],
        },
      ],
    }
    const plan: WorshipPlan = {
      schemaVersion: '0.1',
      serviceId: context.serviceId,
      setlistId: context.setlistId,
      name: context.name,
      songs: [
        {
          songId: 'canto-de-prueba',
          title: 'Señor, aquí estás',
          key: 'G',
          arrangement: [1, 2, 1, 2],
          sections: [
            {
              kind: 'VERSE',
              label: 'Verso',
              lines: [
                {
                  text: 'Jesús, tú eres fiel 🙌',
                  chords: [
                    { symbol: 'G', index: 0 },
                    { symbol: 'D', index: 7 },
                  ],
                },
              ],
            },
            chorus,
            {
              kind: 'VERSE',
              label: 'Verso',
              lines: [
                {
                  text: 'Jesús, tú eres fiel 🙌',
                  chords: [
                    { symbol: 'G', index: 0 },
                    { symbol: 'D', index: 7 },
                  ],
                },
              ],
            },
            chorus,
          ],
        },
      ],
    }
    await page.locator('input[type=file]').setInputFiles({
      name: 'worship-plan.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(plan)),
    })
    await expect(
      page.getByRole('region', {
        name: 'Vista previa del repertorio de Worship',
      }),
    ).toContainText('Señor, aquí estás')
    await page.getByRole('button', { name: 'Confirmar importación' }).click()
    await expect
      .poll(async () => {
        const response = await request.get(`/api/services/${id}`)
        if (!response.ok()) return -1
        const stored = await response.json()
        return stored.service.items.length as number
      })
      .toBe(2)

    const response = await request.get(`/api/services/${id}`)
    expect(response.status()).toBe(200)
    const record = await response.json()
    expect(record.service.items).toHaveLength(2)
    expect(parseService(record.service).items.map((item) => item.kind)).toEqual(
      ['ANNOUNCEMENT', 'SONG'],
    )

    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.locator('.order-item')).toHaveCount(2)
    await expect(
      page.getByText('Servicios sincronizados con PostgreSQL.'),
    ).toBeVisible()
    await page.getByRole('tab', { name: 'Presentación' }).click()
    const serviceDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Descargar para Presenter' }).click()
    const serviceFile = await (await serviceDownload).path()
    const service = parseService(
      JSON.parse(await readFile(serviceFile, 'utf8')),
    )
    expect(service.items.map((item) => item.kind)).toEqual([
      'ANNOUNCEMENT',
      'SONG',
    ])
    const song = service.items[1]
    if (song.kind !== 'SONG') throw new Error('Worship song was not exported')
    expect(song.song.sections.map((section) => section.label)).toEqual([
      'Verso',
      'Coro',
      'Verso',
      'Coro',
    ])
    expect(song.song.sections[0].lines[0].text).toBe('Jesús, tú eres fiel 🙌')
    if (process.env.LVM_PRESENTER_REPO) {
      const projectFile = test.info().outputPath('service.project')
      execFileSync(process.execPath, [
        join(
          process.env.LVM_PRESENTER_REPO,
          'scripts/lvm/service-to-project.mjs',
        ),
        serviceFile,
        projectFile,
      ])
      const project = JSON.parse(await readFile(projectFile, 'utf8')) as {
        project: { shows: { name: string }[] }
      }
      expect(project.project.shows.map((show) => show.name)).toEqual([
        'Bienvenida',
        'Señor, aquí estás',
      ])
    }
  } finally {
    if (id) await request.delete(`/api/services/${id}`)
  }
})
