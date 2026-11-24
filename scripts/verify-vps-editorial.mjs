import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'

const origin = 'https://srv2137598.hstgr.cloud'
const runId = randomUUID()
const email = `editorial-qa-${runId}@example.com`
const headers = { Origin: origin, 'Content-Type': 'application/json' }
const browser = await chromium.launch({ headless: true })
let userId
let lastPage
const ids = "'home','nosotros','general'"
function sql(statement) {
  return execFileSync(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      'hostinger-vps',
      `cd /srv/apps/la-voz-misionera && docker compose exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 -Atc "${statement}"`,
    ],
    { encoding: 'utf8' },
  )
}
try {
  const signup = await fetch(`${origin}/api/auth/signup`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password: randomUUID() }),
  })
  assert.equal(signup.status, 201)
  userId = (await signup.json()).user.id
  assert.match(userId, /^[a-f0-9-]{36}$/)
  sql(`UPDATE public.users SET role='admin' WHERE id='${userId}'`)
  const cookie = signup.headers.get('set-cookie').split(';')[0]
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  await context.addCookies([
    {
      name: '__Host-lvm_session',
      value: cookie.slice(cookie.indexOf('=') + 1),
      url: origin,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  const existing = await context.request.post(
    `${origin}/api/data/rpc/list_site_documents`,
    { headers, data: { p_collection: 'contenido' } },
  )
  assert.equal(existing.status(), 200)
  assert.equal(
    (await existing.json()).filter((row) =>
      ['home', 'nosotros', 'general'].includes(row.id),
    ).length,
    0,
    'Do not overwrite real editorial pages during QA',
  )
  const page = await context.newPage()
  lastPage = page
  const errors = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
    console.error('Service page error:', error.message)
  })
  const publicPage = await context.newPage()
  publicPage.on('pageerror', (error) => errors.push(error.message))
  async function editor(section) {
    await page.goto(`${origin}/service/content`, { waitUntil: 'networkidle' })
    await page
      .getByLabel('Sección', { exact: true })
      .selectOption(`contenido/${section}`)
    await page.getByRole('region', { name: 'Editor de contenido' }).waitFor()
  }
  async function save(action, id) {
    const response = page.waitForResponse((response) =>
      response.url().endsWith('/rpc/save_site_document'),
    )
    await page.getByRole('button', { name: action, exact: true }).click()
    const result = await response
    assert.equal(result.status(), 200)
    const row = (await result.json())[0]
    assert.equal(row.id, id)
    return row
  }
  const homeTitle = `Verificación de inicio ${runId}`
  await editor('home')
  await page
    .getByLabel('Título de bienvenida *', { exact: true })
    .fill(homeTitle)
  await page
    .getByLabel('Texto destacado', { exact: true })
    .fill('Mensaje editorial')
  await page
    .getByLabel('Mensaje de bienvenida *', { exact: true })
    .fill('Texto temporal para verificar la publicación desde Service.')
  await page
    .getByLabel('Título de la transmisión', { exact: true })
    .fill('Verificación temporal de transmisión')
  await page.getByLabel('Mostrar transmisión en vivo', { exact: true }).check()
  await page.getByRole('button', { name: 'Publicar', exact: true }).click()
  await page
    .getByText('Cargá el enlace antes de activar la transmisión', {
      exact: true,
    })
    .waitFor()
  const streamUrl = `https://example.com/lvm-qa-${runId}`
  await page
    .getByLabel('Enlace de la transmisión', { exact: true })
    .fill(streamUrl)
  await save('Guardar borrador', 'home')
  assert.deepEqual(
    await (
      await fetch(
        `${origin}/api/data/site_documents?select=id,data&collection=eq.contenido&id=eq.home&published=eq.true`,
      )
    ).json(),
    [],
  )
  await save('Publicar', 'home')
  await publicPage.goto(origin, { waitUntil: 'domcontentloaded' })
  await publicPage.getByText(homeTitle, { exact: false }).first().waitFor()
  assert.equal(
    await publicPage.getByText('La Palabra que', { exact: true }).count(),
    0,
  )
  await publicPage.goto(`${origin}/envivo`, { waitUntil: 'domcontentloaded' })
  await publicPage
    .getByText('Verificación temporal de transmisión', { exact: true })
    .waitFor()
  await context.route('https://example.com/**', (route) =>
    route.fulfill({ body: 'Temporary QA destination' }),
  )
  const popup = publicPage.waitForEvent('popup')
  await publicPage
    .getByRole('link', { name: 'Abrir transmisión publicada', exact: true })
    .click()
  const opened = await popup
  await opened.waitForLoadState()
  assert.equal(opened.url(), streamUrl)
  await opened.close()
  await page
    .getByLabel('Mostrar transmisión en vivo', { exact: true })
    .uncheck()
  await save('Publicar', 'home')
  await publicPage.reload({ waitUntil: 'domcontentloaded' })
  await publicPage
    .getByText('No hay una transmisión en vivo publicada en este momento.', {
      exact: true,
    })
    .waitFor()

  await editor('nosotros')
  const aboutTitle = `Nosotros QA ${runId}`
  for (const [label, value] of [
    ['Título de la página *', aboutTitle],
    ['Título de la visión *', 'Visión temporal de verificación'],
    ['Visión *', 'Texto temporal de visión'],
    ['Título de la misión *', 'Misión temporal de verificación'],
    ['Misión *', 'Texto temporal de misión'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value)
  await save('Publicar', 'nosotros')
  await publicPage.goto(`${origin}/nosotros`, { waitUntil: 'domcontentloaded' })
  await publicPage.getByText(aboutTitle, { exact: false }).first().waitFor()
  await publicPage
    .getByText('Texto temporal de visión', { exact: true })
    .waitFor()
  await publicPage
    .getByText('Texto temporal de misión', { exact: true })
    .waitFor()

  await editor('general')
  const devotionalTitle = `Devocional QA ${runId}`
  for (const [label, value] of [
    ['Título *', devotionalTitle],
    ['Fecha *', '2026-11-20'],
    ['Versículo *', 'Texto de verificación del versículo'],
    ['Referencia bíblica *', 'Referencia de prueba'],
    ['Reflexión *', 'Texto de verificación de la reflexión'],
    ['Aplicación personal', 'Aplicación de prueba'],
    ['Oración', 'Oración de prueba'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value)
  await save('Publicar', 'general')
  await publicPage.goto(origin, { waitUntil: 'domcontentloaded' })
  await publicPage.getByText(devotionalTitle, { exact: true }).waitFor()
  await publicPage
    .getByText('Texto temporal de misión', { exact: true })
    .waitFor()
  await publicPage.addInitScript(() => {
    window.print = () => {
      window.__printCalled = true
    }
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => {
        window.__shared = data
      },
    })
  })
  await publicPage.goto(`${origin}/devocional`, {
    waitUntil: 'domcontentloaded',
  })
  await publicPage.getByText(devotionalTitle, { exact: true }).waitFor()
  await publicPage
    .getByText('Texto de verificación de la reflexión', { exact: true })
    .waitFor()
  await publicPage
    .getByRole('button', { name: 'IMPRIMIR / GUARDAR PDF', exact: true })
    .click()
  assert.equal(await publicPage.evaluate(() => window.__printCalled), true)
  await publicPage
    .getByRole('button', { name: 'COMPARTIR', exact: true })
    .click()
  assert.equal(
    await publicPage.evaluate(() => window.__shared.title),
    devotionalTitle,
  )
  await mkdir('test-results/vps', { recursive: true })
  await publicPage.screenshot({
    path: 'test-results/vps/devotional-published-desktop.png',
    fullPage: true,
  })
  await publicPage.emulateMedia({ media: 'print' })
  assert.equal(
    await publicPage.locator('.legacy-worship-link').isVisible(),
    false,
  )
  await publicPage.emulateMedia({ media: 'screen' })
  for (const route of ['/', '/nosotros', '/devocional', '/envivo']) {
    await publicPage.setViewportSize({ width: 390, height: 844 })
    await publicPage.goto(`${origin}${route}`, {
      waitUntil: 'domcontentloaded',
    })
    const expected =
      route === '/'
        ? homeTitle
        : route === '/nosotros'
          ? aboutTitle
          : route === '/devocional'
            ? devotionalTitle
            : 'No hay una transmisión en vivo publicada en este momento.'
    await publicPage.getByText(expected, { exact: false }).first().waitFor()
    assert.equal(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      route,
    )
    const clippedControls = await publicPage
      .locator('#public-main [role="button"], #public-main button')
      .evaluateAll((nodes) =>
        nodes
          .filter((node) =>
            node.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true,
            }),
          )
          .filter((node) => {
            const rect = node.getBoundingClientRect()
            return rect.left < -1 || rect.right > innerWidth + 1
          })
          .map((node) => node.textContent?.trim()),
      )
    assert.deepEqual(clippedControls, [], `Clipped mobile actions on ${route}`)
    await publicPage.screenshot({
      path: `test-results/vps/editorial-${route.slice(1) || 'home'}-mobile.png`,
      fullPage: true,
    })
  }
  const failureContext = await browser.newContext()
  await failureContext.route('**/api/data/site_documents?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Temporary QA outage' }),
    }),
  )
  const failedPage = await failureContext.newPage()
  await failedPage.goto(`${origin}/devocional`, {
    waitUntil: 'domcontentloaded',
  })
  await failedPage
    .getByRole('alert')
    .filter({ hasText: 'No pudimos cargar el devocional.' })
    .waitFor()
  await failureContext.unroute('**/api/data/site_documents?*')
  await failedPage
    .getByRole('button', { name: 'REINTENTAR', exact: true })
    .click()
  await failedPage.getByText(devotionalTitle, { exact: true }).waitFor()
  await failureContext.close()
  assert.deepEqual(errors, [])
  console.log(
    'PASS: Service publishes home, About, devotional and live broadcast; private draft, canonical IDs, live URL validation/opening, deactivation, print/share actions and mobile layout.',
  )
} catch (error) {
  await mkdir('test-results/vps', { recursive: true })
  await lastPage
    ?.screenshot({
      path: 'test-results/vps/editorial-failure.png',
      fullPage: true,
    })
    .catch(() => {})
  console.error(
    'Service screen:',
    (await lastPage?.locator('body').innerText())?.slice(0, 1600),
  )
  throw error
} finally {
  await browser.close()
  if (userId) {
    sql(
      `DELETE FROM private.site_document_history WHERE collection='contenido' AND document_id IN (${ids}) AND actor_id='${userId}'`,
    )
    sql(
      `DELETE FROM public.site_documents WHERE collection='contenido' AND id IN (${ids}) AND updated_by='${userId}'`,
    )
    sql(
      `DELETE FROM public.users WHERE id='${userId}' AND id IN (SELECT user_id FROM private.credentials WHERE email='${email}')`,
    )
  }
}
