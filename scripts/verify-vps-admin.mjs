import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const origin = 'https://srv2137598.hstgr.cloud'
const email = `admin-qa-${randomUUID()}@example.com`
const password = randomUUID()
let cookie,
  created = false
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
    body: JSON.stringify({
      email,
      password,
      options: { data: { full_name: 'Verificación administrativa' } },
    }),
  })
  assert.equal(registration.status, 201)
  created = true
  cookie = registration.headers.get('set-cookie').split(';')[0]
  const { user } = await registration.json()
  assert.match(user.id, /^[a-f0-9-]{36}$/)
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
  await page.goto(`${origin}/service/admin`, { waitUntil: 'networkidle' })
  await page
    .getByText('Tu cuenta no tiene permisos de administración.')
    .waitFor()
  sql(`UPDATE public.users SET role='admin' WHERE id='${user.id}'`)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Usuarios y roles' }).waitFor()
  await page.getByRole('heading', { name: 'Solicitudes de la web' }).waitFor()
  await mkdir('test-results/vps', { recursive: true })
  await page.screenshot({
    path: 'test-results/vps/service-admin-desktop.png',
    fullPage: true,
  })
  await page.goto(`${origin}/contacto`, { waitUntil: 'domcontentloaded' })
  await page
    .getByPlaceholder('Tu nombre completo')
    .fill('Verificación del formulario')
  await page.getByPlaceholder('tu@email.com').fill(email)
  await page
    .getByPlaceholder('¿En qué podemos ayudarte?')
    .fill('Prueba de conexión de la web pública con la bandeja de LVM Service.')
  await page
    .getByRole('button', { name: 'Enviar Mensaje', exact: true })
    .click()
  await page.getByText('Mensaje recibido. Gracias por contactarnos.').waitFor()
  await page.goto(`${origin}/service/admin`, { waitUntil: 'networkidle' })
  await page.getByText(email, { exact: true }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  )
  await page.screenshot({
    path: 'test-results/vps/service-admin-mobile.png',
    fullPage: true,
  })
  assert.deepEqual(errors, [])
  console.log(
    'PASS: Service role gate, shared session, administrator users/inbox and real public contact form arriving in Service; no mobile overflow or JavaScript errors',
  )
} finally {
  await browser.close()
  if (created) {
    assert.match(email, /^admin-qa-[a-f0-9-]+@example.com$/)
    sql(`DELETE FROM private.site_inbox WHERE payload->>'email'='${email}'`)
    const deletion = await fetch(`${origin}/api/data/rpc/delete_user`, {
      method: 'POST',
      headers: { ...headers, Cookie: cookie },
      body: '{}',
    })
    assert.equal(deletion.status, 204)
  }
}
