import { expect, test } from '@playwright/test'
import { _electron as electron, chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseService } from '../src/contracts/service'
import { parseWorshipPlan } from '../src/contracts/worshipPlan'

const demo = JSON.parse(
  await readFile(
    new URL('../fixtures/m79d-demo.json', import.meta.url),
    'utf8',
  ),
) as {
  venue: string
  service: Record<string, string>
  songs: Array<{ title: string; key: string; lyrics: string }>
}

test.skip(
  !process.env.WORSHIP_URL,
  'Set WORSHIP_URL to the local Worship preview URL',
)

test('LVM Service → Worship → Service → Presenter demo stays offline', async () => {
  test.setTimeout(180_000)
  const folder = await mkdtemp(join(tmpdir(), 'lvm-m7-'))
  const capture = process.env.LVM_DEMO_CAPTURE === '1'
  const captureDir = join(process.cwd(), 'docs', 'screenshots', 'm79d')
  if (capture) await mkdir(captureDir, { recursive: true })
  const profile = join(folder, 'platform-profile')
  const worshipProfile = join(folder, 'worship-profile')
  let platform = await chromium.launchPersistentContext(profile, {
    headless: true,
    acceptDownloads: true,
  })
  let worship = await chromium.launchPersistentContext(worshipProfile, {
    headless: true,
    acceptDownloads: true,
  })
  try {
    await platform.route(/https?:\/\/(?!127\.0\.0\.1)/, (route) =>
      route.abort(),
    )
    await worship.route(/https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort())
    let page = platform.pages()[0] ?? (await platform.newPage())
    await page.goto('http://127.0.0.1:4173')
    await page.getByRole('link', { name: 'Crear servicio' }).click()
    await page.getByLabel('Nombre').fill(demo.service.title)
    await page.getByLabel('Fecha y hora').fill(demo.service.startsAt)
    await page.getByRole('button', { name: 'Crear servicio' }).click()
    await page.getByRole('tab', { name: 'Información' }).click()
    await page.getByLabel('Sede').fill(demo.venue)
    await page.getByRole('tab', { name: 'Orden' }).click()

    async function add(kind: string, values: Record<string, string>) {
      await page.getByRole('button', { name: /Agregar elemento/ }).click()
      await page.getByLabel('Tipo').selectOption(kind)
      for (const [label, value] of Object.entries(values))
        await page.getByLabel(label, { exact: true }).fill(value)
      await page.getByRole('button', { name: 'Guardar elemento' }).click()
    }
    await add('ANNOUNCEMENT', {
      Título: demo.service.welcome,
      Texto: 'Bienvenidos.',
    })
    await add('ANNOUNCEMENT', {
      Título: demo.service.worship,
      Texto: 'Tiempo de adoración.',
    })
    await add('SERMON', {
      Título: demo.service.sermon,
      Texto: 'Una prédica sobre vivir por fe.',
    })
    await add('ANNOUNCEMENT', {
      Título: demo.service.offering,
      Texto: 'Ofrenda.',
    })
    await add('ANNOUNCEMENT', {
      Título: demo.service.closing,
      Texto: 'Gracias por acompañarnos.',
    })
    await page
      .getByLabel('Colocar el bloque musical después de')
      .selectOption({ label: demo.service.worship })
    if (capture)
      await page.screenshot({
        path: join(captureDir, '01-service-plan.png'),
        fullPage: true,
      })

    const contextDownload = page.waitForEvent('download', { timeout: 10000 })
    await page
      .getByRole('button', { name: '1. Descargar contexto para Worship' })
      .click()
    const contextFile = join(folder, 'context.json')
    await (await contextDownload).saveAs(contextFile)

    const worshipHandoffUrl = await page
      .getByRole('link', { name: 'Abrir LVM Worship' })
      .getAttribute('href')
    expect(worshipHandoffUrl).toContain(`${process.env.WORSHIP_URL}/setlist`)
    const worshipPage = worship.pages()[0] ?? (await worship.newPage())
    await worshipPage.goto(worshipHandoffUrl!, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await expect(
      worshipPage.locator('input[type=file][accept*="json"]'),
    ).toHaveCount(1)
    await worshipPage
      .locator('input[type=file]')
      .first()
      .setInputFiles(contextFile)
    await expect(
      worshipPage.getByText(demo.service.title).first(),
    ).toBeVisible()
    await expect(
      worshipPage.getByRole('link', {
        name: /Return to LVM Service|Volver a LVM Service/,
      }),
    ).toHaveAttribute('href', page.url())
    await worshipPage
      .locator('input[type=file]')
      .last()
      .setInputFiles([
        {
          name: 'uno.cho',
          mimeType: 'text/plain',
          buffer: Buffer.from(
            `{title: ${demo.songs[0].title}}\n{key: ${demo.songs[0].key}}\n{start_of_verse: Verso}\n${demo.songs[0].lyrics}\n{end_of_verse}\n{start_of_chorus: Coro}\n[G]Cantamos\n{end_of_chorus}`,
          ),
        },
        {
          name: 'dos.cho',
          mimeType: 'text/plain',
          buffer: Buffer.from(
            `{title: ${demo.songs[1].title}}\n{key: ${demo.songs[1].key}}\n{start_of_verse}\n${demo.songs[1].lyrics}\n{end_of_verse}`,
          ),
        },
        {
          name: 'tres.cho',
          mimeType: 'text/plain',
          buffer: Buffer.from(
            `{title: ${demo.songs[2].title}}\n{key: ${demo.songs[2].key}}\n{start_of_chorus}\n${demo.songs[2].lyrics}\n{end_of_chorus}`,
          ),
        },
      ])
    await expect(worshipPage.locator('.lvm-set-row')).toHaveCount(3)
    if (capture)
      await worshipPage.screenshot({
        path: join(captureDir, '02-worship-setlist.png'),
        fullPage: true,
      })
    await worshipPage.locator('.lvm-set-row').first().click()
    await worshipPage
      .locator('.lvm-set-row')
      .first()
      .locator('input[placeholder="1,2,1,2"]')
      .fill('1,2,1,2')
    await worshipPage
      .locator('.lvm-set-row')
      .first()
      .locator('select')
      .selectOption('G')
    await worshipPage
      .locator('.lvm-set-row')
      .nth(1)
      .locator('select')
      .selectOption('D')
    await worshipPage
      .locator('.lvm-set-row')
      .nth(2)
      .locator('select')
      .selectOption('A')
    await worship.close()

    worship = await chromium.launchPersistentContext(worshipProfile, {
      headless: true,
      acceptDownloads: true,
    })
    await worship.route(/https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort())
    const reopenedWorship = worship.pages()[0] ?? (await worship.newPage())
    await reopenedWorship.goto(`${process.env.WORSHIP_URL}/setlist`)
    await expect(reopenedWorship.locator('.lvm-set-row')).toHaveCount(3)
    const planDownload = reopenedWorship.waitForEvent('download', {
      timeout: 10000,
    })
    await reopenedWorship
      .getByRole('button', {
        name: /Download for LVM Service|Descargar para LVM Service/,
      })
      .click({ noWaitAfter: true, timeout: 10_000 })
    const planFile = join(folder, 'plan.json')
    await (await planDownload).saveAs(planFile)
    const plan = parseWorshipPlan(JSON.parse(await readFile(planFile, 'utf8')))
    expect(plan.songs.map((song) => song.key)).toEqual(
      demo.songs.map((song) => song.key),
    )
    expect(plan.songs[0].arrangement).toEqual([1, 2, 1, 2])

    await page
      .locator('input[type=file]')
      .setInputFiles(planFile, { timeout: 5_000 })
    await expect(
      page.getByRole('region', {
        name: 'Vista previa del repertorio de Worship',
      }),
    ).toContainText('3 canciones')
    await expect(page.locator('.order-item')).toHaveCount(5)
    await page.getByRole('button', { name: 'Confirmar importación' }).click()
    await expect(page.locator('.order-item')).toHaveCount(8)
    await expect(
      page.getByText('Repertorio de Worship importado y guardado'),
    ).toBeVisible()
    if (capture)
      await page.screenshot({
        path: join(captureDir, '03-service-import.png'),
        fullPage: true,
      })
    await platform.close()
    platform = await chromium.launchPersistentContext(profile, {
      headless: true,
      acceptDownloads: true,
    })
    await platform.route(/https?:\/\/(?!127\.0\.0\.1)/, (route) =>
      route.abort(),
    )
    page = platform.pages()[0] ?? (await platform.newPage())
    await page.goto('http://127.0.0.1:4173/services', {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    })
    await page
      .getByRole('link', { name: /^Abrir(?: servicio)?/ })
      .first()
      .click({ timeout: 5_000 })
    await expect(page.locator('.order-item')).toHaveCount(8)
    await page.getByRole('tab', { name: 'Presentación' }).click()
    if (capture)
      await page.screenshot({
        path: join(captureDir, '04-service-presenter-handoff.png'),
        fullPage: true,
      })
    const serviceDownload = page.waitForEvent('download', { timeout: 10000 })
    await page.getByRole('button', { name: 'Descargar para Presenter' }).click()
    const serviceFile = join(folder, 'service.json')
    const finalDownload = await serviceDownload
    await finalDownload.saveAs(serviceFile)
    const service = parseService(
      JSON.parse(await readFile(serviceFile, 'utf8')),
    )
    expect(service.items.map((item) => item.kind)).toEqual([
      'ANNOUNCEMENT',
      'ANNOUNCEMENT',
      'SONG',
      'SONG',
      'SONG',
      'SERMON',
      'ANNOUNCEMENT',
      'ANNOUNCEMENT',
    ])
    expect(service.items[1]).toMatchObject({
      announcement: { title: demo.service.worship },
    })
    expect(service.items[2]).toMatchObject({
      song: { title: demo.songs[0].title, key: 'G' },
    })
    expect(service.items[5]).toMatchObject({
      sermon: { title: demo.service.sermon },
    })
    expect(service.items[7]).toMatchObject({
      announcement: { title: demo.service.closing },
    })

    if (process.env.PRESENTER_REPO) {
      const projectFile = join(folder, 'service.project')
      execFileSync(
        process.execPath,
        [
          join(
            process.env.PRESENTER_REPO,
            'scripts/lvm/service-to-project.mjs',
          ),
          serviceFile,
          projectFile,
        ],
        { cwd: process.env.PRESENTER_REPO },
      )
      const project = JSON.parse(await readFile(projectFile, 'utf8'))
      expect(project.project.shows).toHaveLength(8)
      await presentAndReopen(process.env.PRESENTER_REPO, projectFile, folder)
    }
  } finally {
    await platform.close().catch(() => {})
    await worship.close().catch(() => {})
    await rm(folder, { recursive: true, force: true })
  }
})

async function presentAndReopen(
  presenterRepo: string,
  projectFile: string,
  folder: string,
) {
  const settings = join(folder, 'presenter-settings')
  const data = join(folder, 'presenter-data')
  const appData = join(folder, 'presenter-appdata')
  await mkdir(settings)
  await mkdir(data)
  await mkdir(appData)

  async function launch() {
    const app = await electron.launch({
      executablePath: join(
        presenterRepo,
        'node_modules/electron/dist/electron.exe',
      ),
      cwd: presenterRepo,
      args: ['.', '--no-sandbox'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        FS_MOCK_STORE_PATH: settings,
        APPDATA: appData,
      },
    })
    await app.evaluate(({ dialog }, location) => {
      dialog.showOpenDialog = async (): Promise<{
        canceled: boolean
        filePaths: string[]
      }> => ({ canceled: false, filePaths: [location] })
    }, data)
    let window = app
      .windows()
      .find((candidate) => candidate.url().includes('localhost:3000'))
    for (let i = 0; i < 40 && !window; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      window = app
        .windows()
        .find((candidate) => candidate.url().includes('localhost:3000'))
    }
    if (!window) throw new Error('Presenter main window did not open')
    await window
      .locator('.popup button.start, .top')
      .first()
      .waitFor({ timeout: 30000 })
    await app.evaluate(({ session }) => {
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: ['http://*/*', 'https://*/*'] },
        (details, callback) =>
          callback({
            cancel: !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//.test(
              details.url,
            ),
          }),
      )
    })
    return { app, window }
  }

  async function close(app: Awaited<ReturnType<typeof electron.launch>>) {
    const child = app.process()
    void app
      .evaluate(() => {
        const path = process.getBuiltinModule('node:path')
        const require = process
          .getBuiltinModule('node:module')
          .createRequire(path.join(process.cwd(), 'build/electron/index.js'))
        void require(
          path.join(process.cwd(), 'build/electron/utils/close.js'),
        ).exitApp()
      })
      .catch(() => {})
    await Promise.race([
      app.close().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ])
    if (child?.pid && !child.killed) {
      try {
        execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
        })
      } catch {
        // Electron already exited.
      }
    }
  }

  let { app, window } = await launch()
  try {
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
      }> => ({ canceled: false, filePaths: [location] })
    }, projectFile)
    await window.locator('.addButton').first().click()
    await window
      .locator('.addMenu')
      .getByText('Import')
      .click({ timeout: 5000 })
    await expect(window.locator('.popup').getByText('Imported!')).toBeVisible({
      timeout: 10000,
    })
    await window.locator('.popup button').first().click()
    await window.getByText(demo.service.title).first().click()
    await window.getByText(demo.songs[0].title).first().click()
    await expect(window.getByText('Cantamos con fe').first()).toBeVisible({
      timeout: 30000,
    })
    await window.getByText('Cantamos con fe').first().click()
    await expect(
      window.locator('.previewOutput').getByText('Cantamos con fe').first(),
    ).toBeVisible({ timeout: 30000 })
    await expect
      .poll(() =>
        window.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue('--secondary')
            .trim()
            .toLowerCase(),
        ),
      )
      .toBe('#c6a15b')
    // Exercise a physical Presenter output with the same selected slide. The
    // demo profile has no configured display, so create one through Presenter's
    // own output helper and turn it on with the normal toolbar control.
    await window.evaluate(async () => {
      const modulePath = '/src/frontend/components/helpers/output.ts'
      const { addOutput } = await import(/* @vite-ignore */ modulePath)
      addOutput(false, '', true, 'LVM Demo Output')
    })
    await window.locator('#output_window_button').click()
    await expect
      .poll(
        async () =>
          app.windows().filter((candidate) => candidate !== window).length,
        {
          timeout: 15000,
        },
      )
      .toBeGreaterThan(0)
    const physicalOutput = app
      .windows()
      .find((candidate) => candidate !== window)!
    await expect(
      physicalOutput.getByText('Cantamos con fe').first(),
    ).toBeVisible({
      timeout: 15000,
    })
    if (process.env.LVM_DEMO_CAPTURE === '1') {
      const location = join(
        process.cwd(),
        'docs',
        'screenshots',
        'm79d',
        '05-presenter-slide.png',
      )
      await window.screenshot({ path: location })
      await physicalOutput.screenshot({
        path: join(
          process.cwd(),
          'docs',
          'screenshots',
          'm79d',
          '05b-presenter-physical-output.png',
        ),
      })
    }
    await window.keyboard.press('Control+s')
    await expect
      .poll(
        async () =>
          (await readFile(join(settings, 'projects.json'), 'utf8')).includes(
            demo.service.title,
          ),
        { timeout: 15000 },
      )
      .toBe(true)
    await expect
      .poll(
        async () =>
          (await readdir(join(data, 'Shows'))).filter((name) =>
            name.endsWith('.show'),
          ).length,
        { timeout: 15000 },
      )
      .toBe(8)
  } finally {
    await close(app)
  }

  ;({ app, window } = await launch())
  try {
    await expect
      .poll(
        async () =>
          (await window.locator('body').innerText()).includes('All\n\n8'),
        { timeout: 30000 },
      )
      .toBe(true)
    await expect(window.getByText(demo.service.title).first()).toBeVisible({
      timeout: 30000,
    })
    await window.getByText(demo.service.title).first().click()
    await expect(window.getByText(demo.songs[0].title).first()).toBeVisible({
      timeout: 30000,
    })
    await window.getByText(demo.songs[0].title).first().click()
    await expect(window.getByText('Cantamos con fe').first()).toBeVisible({
      timeout: 30000,
    })
  } finally {
    await close(app)
  }
}
