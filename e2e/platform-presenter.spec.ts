import { expect, test } from '@playwright/test'
import { _electron as electron, chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseService } from '../src/contracts/service'

test('creates, reopens, exports and presents a service without Internet', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lvm-m6-'))
  const profile = join(folder, 'browser-profile')
  let context = await chromium.launchPersistentContext(profile, {
    channel: 'msedge',
    headless: true,
    acceptDownloads: true,
  })
  try {
    await context.route(/https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort())
    let page = context.pages()[0] ?? (await context.newPage())
    await page.goto('http://127.0.0.1:4173')
    await page.getByRole('link', { name: 'Crear servicio' }).click()
    await page.getByLabel('Nombre').fill('Culto M6 offline')
    await page.getByLabel('Fecha y hora').fill('2026-10-04T19:00')
    await page.getByRole('button', { name: 'Crear servicio' }).click()

    async function add(kind: string, values: Record<string, string>) {
      await page.getByRole('button', { name: /Agregar elemento/ }).click()
      await page.getByLabel('Tipo').selectOption(kind)
      for (const [label, value] of Object.entries(values))
        await page.getByLabel(label, { exact: true }).fill(value)
      await page.getByRole('button', { name: 'Guardar elemento' }).click()
    }

    await add('ANNOUNCEMENT', {
      Título: 'Bienvenida',
      Texto: 'Bienvenidos al culto.',
    })
    await add('SONG', {
      'Título de la canción': 'Canto de apertura',
      Tonalidad: 'A',
      'Secciones y letra':
        '# Verso 1\n[A]Alzamos la voz 😀\n\n# Coro\n[D]Cantamos con fe\n\n# Coro\n[D]Cantamos con fe',
    })
    await add('SONG', {
      'Título de la canción': 'Canto de gratitud',
      Tonalidad: 'G',
      'Secciones y letra': '# Verso 1\n[G]Gracias por este día',
    })
    await add('SERMON', {
      Título: 'El buen pastor',
      Texto: 'Reflexión del día.',
    })
    await add('SCRIPTURE', {
      Referencia: 'Juan 3:16',
      Versión: 'RV1909',
      'Texto local': 'Porque de tal manera amó Dios al mundo...',
    })
    await add('ANNOUNCEMENT', {
      Título: 'Encuentro de jóvenes',
      Texto: 'Sábado a las 18:00.',
    })
    await page.getByRole('button', { name: 'Subir Juan 3:16 · RV1909' }).click()
    await page
      .getByRole('button', { name: 'Subir Encuentro de jóvenes' })
      .click()
    await expect(page.locator('.order-item')).toHaveCount(6)

    await context.close()
    context = await chromium.launchPersistentContext(profile, {
      channel: 'msedge',
      headless: true,
      acceptDownloads: true,
    })
    await context.route(/https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort())
    page = context.pages()[0] ?? (await context.newPage())
    await page.goto('http://127.0.0.1:4173/services')
    await expect(
      page.getByRole('heading', { name: 'Culto M6 offline' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Abrir servicio' }).click()
    await expect(page.locator('.order-item')).toHaveCount(6)
    await page.screenshot({
      path: join(process.cwd(), 'test-results', 'm6-platform.png'),
      fullPage: true,
    })
    await page.getByRole('tab', { name: 'Presentación' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar Service 0.1' }).click()
    const download = await downloadPromise
    const servicePath = join(folder, 'service.json')
    await download.saveAs(servicePath)
    const service = parseService(
      JSON.parse(await readFile(servicePath, 'utf8')),
    )
    expect(service.items.map((item) => item.kind)).toEqual([
      'ANNOUNCEMENT',
      'SONG',
      'SONG',
      'SCRIPTURE',
      'ANNOUNCEMENT',
      'SERMON',
    ])
    expect(
      service.items[1].kind === 'SONG' &&
        service.items[1].song.sections.map((section) => section.label),
    ).toEqual(['Verso 1', 'Coro', 'Coro'])

    if (process.env.PRESENTER_REPO)
      await presentInElectron(process.env.PRESENTER_REPO, servicePath, folder)
  } finally {
    await context.close().catch(() => {})
    await rm(folder, { recursive: true, force: true })
  }
})

async function presentInElectron(
  presenterRepo: string,
  servicePath: string,
  folder: string,
) {
  const projectPath = join(folder, 'service.project')
  execFileSync(
    process.execPath,
    [
      join(presenterRepo, 'scripts/lvm/service-to-project.mjs'),
      servicePath,
      projectPath,
    ],
    { cwd: presenterRepo },
  )
  const project = JSON.parse(await readFile(projectPath, 'utf8'))
  expect(project.project.shows).toHaveLength(6)
  const settings = join(folder, 'presenter-settings')
  const data = join(folder, 'presenter-data')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(settings)
  await mkdir(data)
  const app = await electron.launch({
    executablePath: join(
      presenterRepo,
      'node_modules/electron/dist/electron.exe',
    ),
    cwd: presenterRepo,
    args: ['.', '--no-sandbox'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      FS_MOCK_STORE_PATH: settings,
    },
  })
  try {
    await app.evaluate(({ dialog }, location) => {
      dialog.showOpenDialog = async (): Promise<{
        canceled: boolean
        filePaths: string[]
      }> => ({
        canceled: false,
        filePaths: [location],
      })
    }, data)
    let window = app
      .windows()
      .find((candidate) => candidate.url().includes('index.html'))
    for (let i = 0; i < 40 && !window; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      window = app
        .windows()
        .find((candidate) => candidate.url().includes('index.html'))
    }
    if (!window) throw new Error('Presenter main window did not open')
    await window
      .locator('.popup button.start, .top')
      .first()
      .waitFor({ timeout: 30000 })
    await app.evaluate(({ session }) => {
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: ['http://*/*', 'https://*/*'] },
        (_details, callback) => callback({ cancel: true }),
      )
    })
    const setup = window.locator('.popup button.start')
    if (await setup.count()) {
      const popup = window.locator('.popup')
      await popup.locator('.dropdown-trigger').first().click()
      await popup
        .locator('li[role=option]')
        .filter({ hasText: 'English' })
        .first()
        .click()
      await popup.locator('.button-trigger').first().click()
      await setup.click()
      await window
        .locator('#guideButtons')
        .getByText('Skip')
        .click({ timeout: 30000 })
    }
    await app.evaluate(({ dialog }, location) => {
      dialog.showOpenDialog = async (): Promise<{
        canceled: boolean
        filePaths: string[]
      }> => ({
        canceled: false,
        filePaths: [location],
      })
    }, projectPath)
    await window.locator('.addButton').first().click()
    await window.locator('.addMenu').getByText('Import').click()
    await expect(window.locator('.popup').getByText('Imported!')).toBeVisible({
      timeout: 30000,
    })
    await window.locator('.popup button').first().click()
    await window.getByText('Culto M6 offline').first().click()
    await window.getByText('Canto de apertura').first().click()
    await expect(window.getByText('Alzamos la voz 😀').first()).toBeVisible({
      timeout: 30000,
    })
    await window.getByText('Alzamos la voz 😀').first().click()
    await expect(
      window.locator('.previewOutput').getByText('Alzamos la voz 😀').first(),
    ).toBeVisible({ timeout: 30000 })
  } finally {
    const child = app.process()
    await Promise.race([
      app.close().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ])
    if (child && !child.killed) child.kill('SIGKILL')
  }
}
