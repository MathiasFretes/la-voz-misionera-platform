import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'

const origin = 'https://srv2137598.hstgr.cloud'
const run = randomUUID()
const headers = { Origin: origin, 'Content-Type': 'application/json' }
const browser = await chromium.launch({ headless: true })
const users = []
let churchId
const errors = []
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
async function signup(label) {
  const response = await fetch(`${origin}/api/auth/signup`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: `identity-browser-${label}-${run}@example.com`,
      password: randomUUID(),
      options: { data: { full_name: `QA ${label} ${run}` } },
    }),
  })
  assert.equal(response.status, 201)
  const { user } = await response.json()
  assert.match(user.id, /^[a-f0-9-]{36}$/)
  users.push(user.id)
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  await context.addCookies([
    {
      name: '__Host-lvm_session',
      value: response.headers.get('set-cookie').split(';')[0].split('=')[1],
      url: origin,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  return { ...user, page, context }
}
const saved = (page, name) =>
  page.waitForResponse(
    (response) =>
      response.url().endsWith(`/rpc/${name}`) &&
      response.request().method() === 'POST',
  )
async function submitMembership(page, user, role) {
  await page
    .getByRole('combobox', { name: 'Cuenta de la membresía' })
    .selectOption(user.id)
  await page
    .getByRole('combobox', { name: 'Rol en la iglesia' })
    .selectOption(role)
  const result = saved(page, 'save_church_membership')
  await page
    .getByRole('button', { name: 'Guardar membresía', exact: true })
    .click()
  assert.equal((await result).status(), 200)
  await page.getByText(/Membresía guardada/).waitFor()
}
try {
  const global = await signup('global')
  const coordinator = await signup('coordinator')
  const member = await signup('member')
  sql(`UPDATE public.users SET role='admin' WHERE id='${global.id}'`)
  const page = global.page
  await page.goto(`${origin}/service/admin`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Iglesias y membresías' }).waitFor()
  await page
    .getByRole('textbox', { name: 'Nombre de la iglesia' })
    .fill(`QA Iglesia ${run}`)
  const creation = saved(page, 'save_church')
  await page
    .getByRole('button', { name: 'Guardar iglesia', exact: true })
    .click()
  const created = await creation
  assert.equal(created.status(), 200)
  churchId = (await created.json())[0].id
  assert.match(churchId, /^[a-f0-9-]{36}$/)
  await page.getByText('Iglesia guardada.', { exact: true }).waitFor()
  await submitMembership(page, coordinator, 'admin')
  await submitMembership(page, member, 'member')
  const scoped = coordinator.page
  await scoped.goto(`${origin}/service/`, { waitUntil: 'domcontentloaded' })
  await scoped
    .getByRole('heading', { name: 'Mi organización', exact: true })
    .waitFor()
  assert.equal(
    await scoped
      .getByRole('link', { name: 'Administración', exact: true })
      .count(),
    0,
  )
  assert.equal(
    await scoped
      .getByRole('button', { name: 'Guardar iglesia', exact: true })
      .count(),
    0,
  )
  await scoped
    .getByRole('combobox', { name: 'Cuenta de la membresía' })
    .selectOption(coordinator.id)
  assert.equal(
    await scoped
      .getByRole('button', { name: 'Guardar membresía', exact: true })
      .isDisabled(),
    true,
  )
  await submitMembership(scoped, member, 'leader')
  await scoped.goto(`${origin}/service/admin`, {
    waitUntil: 'domcontentloaded',
  })
  await scoped
    .getByText('Tu rol de iglesia no autoriza esta sección.')
    .waitFor()
  assert.equal(
    await scoped.getByRole('heading', { name: 'Usuarios y roles' }).count(),
    0,
  )
  await scoped.getByRole('link', { name: 'Ver mi iglesia' }).click()
  await scoped
    .getByRole('heading', { name: 'Mi organización', exact: true })
    .waitFor()
  // Another administrator changes the same membership before this editor saves.
  await scoped
    .getByRole('combobox', { name: 'Cuenta de la membresía' })
    .selectOption(member.id)
  await page
    .getByRole('button', { name: 'Descartar cambios y recargar membresías' })
    .click()
  await submitMembership(page, member, 'viewer')
  await scoped
    .getByRole('combobox', { name: 'Rol en la iglesia' })
    .selectOption('member')
  const conflict = saved(scoped, 'save_church_membership')
  await scoped
    .getByRole('button', { name: 'Guardar membresía', exact: true })
    .click()
  assert.equal((await conflict).status(), 409)
  await scoped
    .getByRole('alert')
    .filter({ hasText: 'La membresía cambió' })
    .waitFor()
  assert.equal(
    await scoped
      .getByRole('combobox', { name: 'Rol en la iglesia' })
      .inputValue(),
    'member',
  )
  await scoped
    .getByRole('button', { name: 'Descartar cambios y recargar membresías' })
    .click()
  await scoped
    .getByRole('combobox', { name: 'Cuenta de la membresía' })
    .selectOption(member.id)
  assert.equal(
    await scoped
      .getByRole('combobox', { name: 'Rol en la iglesia' })
      .inputValue(),
    'viewer',
  )
  await mkdir('test-results/vps', { recursive: true })
  await scoped.screenshot({
    path: 'test-results/vps/identity-church-desktop.png',
    fullPage: true,
  })
  await scoped.setViewportSize({ width: 390, height: 844 })
  assert.ok(
    await scoped.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Mobile page must not overflow',
  )
  const clipped = await scoped
    .locator('main button:visible, main select:visible, main input:visible')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.left < -1 || rect.right > innerWidth + 1
        })
        .map((element) => element.textContent),
    )
  assert.deepEqual(clipped, [], 'Mobile form controls must fit')
  await scoped.screenshot({
    path: 'test-results/vps/identity-church-mobile.png',
    fullPage: true,
  })
  await page
    .getByRole('combobox', { name: 'Estado de la iglesia' })
    .selectOption('suspended')
  const suspension = saved(page, 'save_church')
  await page
    .getByRole('button', { name: 'Guardar iglesia', exact: true })
    .click()
  assert.equal((await suspension).status(), 200)
  await scoped.reload({ waitUntil: 'domcontentloaded' })
  await scoped
    .getByText('Tu cuenta no tiene permisos de administración.')
    .waitFor()
  assert.deepEqual(errors, [])
  console.log(
    'PASS: global church creation and assignment, scoped Service entry, protected administrator, global route denial, concurrent conflict with preserved input, explicit reload, suspension and mobile layout',
  )
} finally {
  await browser.close()
  if (churchId)
    sql(
      `DELETE FROM private.churches WHERE id='${churchId}' AND name='QA Iglesia ${run}'`,
    )
  for (const id of users)
    sql(
      `DELETE FROM public.users WHERE id='${id}' AND EXISTS(SELECT FROM private.credentials c WHERE c.user_id=public.users.id AND c.email LIKE 'identity-browser-%-${run}@example.com')`,
    )
}
