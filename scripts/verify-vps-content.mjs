import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'

const origin = 'https://srv2137598.hstgr.cloud'
const runId = randomUUID()
const email = `cms-qa-${runId}@example.com`
const password = randomUUID()
const title = `Verificación temporal ${runId}`
let userId, documentId
const browser = await chromium.launch({ headless: true })
const headers = { Origin: origin, 'Content-Type': 'application/json' }
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
  const registration = await fetch(`${origin}/api/auth/signup`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password }),
  })
  assert.equal(registration.status, 201)
  const result = await registration.json()
  userId = result.user.id
  assert.match(userId, /^[a-f0-9-]{36}$/)
  sql(`UPDATE public.users SET role='admin' WHERE id='${userId}'`)
  const cookie = registration.headers.get('set-cookie').split(';')[0]
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
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${origin}/service/`, { waitUntil: 'networkidle' })
  await page
    .getByRole('link', { name: 'Administrar contenido', exact: true })
    .click()
  await page.waitForURL('**/service/content')
  await page.getByRole('heading', { name: 'Nuevo contenido' }).waitFor()
  await page.getByLabel('Nombre *', { exact: true }).fill(title)
  await page.getByLabel('Fecha *', { exact: true }).fill('2026-11-20')
  await page.getByLabel('Hora *', { exact: true }).fill('19:00')
  await page
    .getByLabel('Lugar *', { exact: true })
    .fill('Prueba técnica temporal')
  const saved = page.waitForResponse((response) =>
    response.url().endsWith('/rpc/save_site_document'),
  )
  await page
    .getByRole('button', { name: 'Guardar borrador', exact: true })
    .click()
  const savedResponse = await saved
  assert.equal(savedResponse.status(), 200)
  documentId = (await savedResponse.json())[0].id
  assert.match(documentId, /^[a-f0-9-]{36}$/)
  const readPublished = async () =>
    (
      await fetch(
        `${origin}/api/data/site_documents?select=collection,id,data&collection=eq.eventos&id=eq.${documentId}&published=eq.true`,
      )
    ).json()
  assert.deepEqual(await readPublished(), [])
  await page.getByRole('button', { name: 'Publicar', exact: true }).click()
  await page.locator('small').filter({ hasText: 'Revisión 2' }).waitFor()
  assert.equal((await readPublished())[0].data.name, title)
  const publicPage = await context.newPage()
  let contentCookie
  publicPage.on('request', async (request) => {
    if (request.url().includes('/api/data/site_documents'))
      contentCookie = (await request.allHeaders()).cookie || ''
  })
  await publicPage.goto(`${origin}/calendario`, { waitUntil: 'networkidle' })
  await publicPage.getByText(title, { exact: true }).waitFor()
  assert.equal(
    contentCookie,
    '',
    'The public site must not use the administrator session',
  )
  await page.getByLabel('Nombre *', { exact: true }).fill('Mi corrección local')
  const remote = await context.request.post(
    `${origin}/api/data/rpc/save_site_document`,
    {
      headers,
      data: {
        p_collection: 'eventos',
        p_id: documentId,
        p_expected_revision: 2,
        p_action: 'save',
        p_data: {
          name: 'Edición de otro administrador',
          date: '2026-11-20',
          time: '19:00',
          day: 'Prueba técnica temporal',
        },
      },
    },
  )
  assert.equal(remote.status(), 200)
  await page
    .getByRole('button', { name: 'Guardar borrador', exact: true })
    .click()
  await page
    .getByText(
      'El contenido cambió en otra sesión. Recargá antes de guardar.',
      { exact: true },
    )
    .waitFor()
  assert.equal(
    await page.getByLabel('Nombre *', { exact: true }).inputValue(),
    'Mi corrección local',
  )
  assert.equal((await readPublished())[0].data.name, title)
  await mkdir('test-results/vps', { recursive: true })
  await page.screenshot({
    path: 'test-results/vps/service-content-conflict.png',
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Cargar versión actual', exact: true })
    .click()
  await page.locator('small').filter({ hasText: 'Revisión 3' }).waitFor()
  assert.equal(
    await page.getByLabel('Nombre *', { exact: true }).inputValue(),
    'Edición de otro administrador',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  )
  await page.screenshot({
    path: 'test-results/vps/service-content-mobile.png',
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Retirar de la web', exact: true })
    .click()
  await page.locator('small').filter({ hasText: 'Revisión 4' }).waitFor()
  assert.deepEqual(await readPublished(), [])
  await publicPage.reload({ waitUntil: 'networkidle' })
  assert.equal(await publicPage.getByText(title, { exact: true }).count(), 0)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: real Service editor → PostgreSQL → public calendar; private draft, explicit publication, anonymous public read, concurrent-edit conflict preserving input, mobile layout and withdrawal.',
  )
} finally {
  await browser.close()
  if (documentId) {
    assert.match(documentId, /^[a-f0-9-]{36}$/)
    sql(
      `DELETE FROM private.site_document_history WHERE collection='eventos' AND document_id='${documentId}'`,
    )
    sql(
      `DELETE FROM public.site_documents WHERE collection='eventos' AND id='${documentId}' AND updated_by='${userId}'`,
    )
  }
  if (userId) {
    assert.match(email, /^cms-qa-[a-f0-9-]+@example.com$/)
    sql(
      `DELETE FROM public.users WHERE id='${userId}' AND id IN (SELECT user_id FROM private.credentials WHERE email='${email}')`,
    )
  }
}
