import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { chromium } from '@playwright/test'

const origin = 'https://srv2137598.hstgr.cloud'
const backend = 'http://127.0.0.1:54319'
const church = randomUUID()
const serviceId = randomUUID()
const users = []
const assets = resolve('dist')
const browser = await chromium.launch({ headless: true })
const errors = []
function sql(statement) {
  return execFileSync(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      'hostinger-vps',
      `cd /srv/apps/la-voz-misionera && docker compose exec -T postgres psql -U lvm_owner -d lvm_planning_qa_20261121 -v ON_ERROR_STOP=1 -Atc "${statement}"`,
    ],
    { encoding: 'utf8' },
  )
}
async function api(
  path,
  user,
  input,
  method = input === undefined ? 'GET' : 'POST',
  operation,
) {
  const response = await fetch(`${backend}/api/${path}`, {
    method,
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      ...(user ? { Cookie: user.cookie, 'X-LVM-Account': user.id } : {}),
      ...(operation ? { 'X-LVM-Operation': operation } : {}),
    },
    body: input === undefined ? undefined : JSON.stringify(input),
  })
  const result = await response.json()
  return {
    status: response.status,
    result,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  }
}
const ok = (response) => {
  assert.equal(response.status, 200, JSON.stringify(response.result))
  return response.result
}
async function account(label) {
  const response = await api('auth/signup', null, {
    email: `review-qa-${label}-${randomUUID()}@example.com`,
    password: randomUUID(),
  })
  assert.equal(response.status, 201)
  users.push(response.result.user.id)
  return { id: response.result.user.id, cookie: response.cookie }
}
async function context(user) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  await context.route(`${origin}/service**`, async (route) => {
    const path = new URL(route.request().url()).pathname
    const file = resolve(
      assets,
      path.startsWith('/service/assets/')
        ? path.slice('/service/'.length)
        : 'index.html',
    )
    assert.ok(file.startsWith(assets + sep))
    await route.fulfill({
      status: 200,
      contentType:
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
        }[extname(file)] || 'application/octet-stream',
      body: await readFile(file),
    })
  })
  await context.route(`${origin}/api/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url())
    const headers = Object.fromEntries(
      Object.entries(request.headers()).filter(([name]) =>
        [
          'cookie',
          'origin',
          'content-type',
          'x-lvm-account',
          'x-lvm-operation',
        ].includes(name),
      ),
    )
    const response = await fetch(`${backend}${path.pathname}${path.search}`, {
      method: request.method(),
      headers,
      body: request.method() === 'GET' ? undefined : request.postDataBuffer(),
    })
    await route.fulfill({
      status: response.status,
      contentType: 'application/json',
      body: await response.text(),
    })
  })
  await context.addCookies([
    {
      name: '__Host-lvm_session',
      value: user.cookie.split('=')[1],
      url: origin,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  return page
}
try {
  const admin = await account('admin')
  const musician = await account('musician')
  sql(`UPDATE public.users SET role='admin' WHERE id='${admin.id}'`)
  ok(
    await api('data/rpc/save_church', admin, {
      p_id: church,
      p_name: 'Iglesia QA musical',
      p_status: 'active',
      p_expected_revision: 0,
    }),
  )
  ok(
    await api('data/rpc/save_church_membership', admin, {
      p_church_id: church,
      p_user_id: musician.id,
      p_role: 'member',
      p_status: 'active',
      p_expected_revision: 0,
    }),
  )
  const path = `churches/${church}/services/${serviceId}`
  const record = {
    id: serviceId,
    venue: 'Central',
    worshipAfterItemId: 'welcome',
    service: {
      schemaVersion: '0.1',
      id: serviceId,
      title: 'Culto con música',
      startsAt: '2026-12-01T12:00:00Z',
      setlist: { id: 'set-qa', name: 'Adoración' },
      items: [
        {
          id: 'welcome',
          kind: 'ANNOUNCEMENT',
          announcement: { title: 'Bienvenida manual', body: 'Comunidad' },
        },
      ],
    },
  }
  ok(await api(path, admin, record, 'PUT', randomUUID()))
  const plan = {
    schemaVersion: '0.1',
    serviceId,
    setlistId: 'set-qa',
    name: 'Adoración',
    songs: [
      {
        songId: 'song-qa',
        title: 'Fiel en comunidad',
        key: 'G',
        arrangement: [1],
        sections: [
          {
            kind: 'verse',
            label: 'Verso',
            lines: [{ text: 'Fiel en comunidad', chords: [] }],
          },
        ],
      },
    ],
  }
  ok(
    await api(
      `${path}/worship`,
      musician,
      { plan, revision: 0, serviceRevision: 1 },
      'PUT',
      randomUUID(),
    ),
  )
  const page = await context(admin)
  await page.goto(`${origin}/service/services/${serviceId}`, {
    waitUntil: 'domcontentloaded',
  })
  const review = page.getByRole('region', {
    name: 'Repertorio conectado de Worship',
  })
  await review.getByText('Fiel en comunidad', { exact: true }).waitFor()
  assert.equal(
    ok(await api(`churches/${church}/services`, admin))[0].service.items.length,
    1,
  )
  await review.getByRole('button', { name: 'Revisar incorporación' }).click()
  await review.getByRole('alertdialog').waitFor()
  await review.getByRole('button', { name: 'Confirmar incorporación' }).click()
  await review
    .getByText(
      'Repertorio incorporado al culto. Los elementos manuales se conservaron.',
      { exact: true },
    )
    .waitFor()
  const merged = ok(await api(`churches/${church}/services`, admin))[0]
  assert.deepEqual(
    merged.service.items.map((item) => item.id),
    ['welcome', `lvm-worship:${serviceId}:1`],
  )
  await page
    .locator('strong')
    .filter({ hasText: /^Bienvenida manual$/ })
    .waitFor()
  await review
    .getByText('Esta propuesta ya fue incorporada al culto.', { exact: true })
    .waitFor()
  ok(
    await api(
      `${path}/worship`,
      musician,
      { plan, revision: 1, serviceRevision: 2 },
      'PUT',
      randomUUID(),
    ),
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await review.getByRole('button', { name: 'Revisar incorporación' }).waitFor()
  ok(
    await api(
      path,
      admin,
      { ...merged, venue: 'Sede actualizada' },
      'PUT',
      randomUUID(),
    ),
  )
  await review.getByRole('button', { name: 'Revisar incorporación' }).click()
  await review.getByRole('button', { name: 'Confirmar incorporación' }).click()
  await review
    .getByRole('alert')
    .filter({ hasText: 'El culto o repertorio cambió' })
    .waitFor()
  await review.getByText('Fiel en comunidad', { exact: true }).waitFor()
  await review.getByRole('button', { name: 'Seguir revisando' }).click()
  await review.getByRole('button', { name: 'Actualizar repertorio' }).click()
  await review
    .getByRole('alert')
    .filter({ hasText: 'Los músicos deben revisar el contexto actualizado' })
    .waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  )
  await mkdir('test-results/worship-exchange', { recursive: true })
  await page.screenshot({
    path: 'test-results/worship-exchange/service-review-mobile.png',
    fullPage: true,
  })
  const memberPage = await context(musician)
  await memberPage.goto(`${origin}/service/services/${serviceId}`, {
    waitUntil: 'domcontentloaded',
  })
  const memberReview = memberPage.getByRole('region', {
    name: 'Repertorio conectado de Worship',
  })
  await memberReview
    .getByRole('link', { name: 'Preparar en Worship' })
    .waitFor()
  assert.equal(
    await memberReview
      .getByRole('button', { name: 'Revisar incorporación' })
      .count(),
    0,
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS: Service review UI with real isolated API/PostgreSQL: musical proposal preview, explicit confirmation, canonical merge preserving manual order, already-applied status, live revision conflict, context-refresh requirement, musician read-only review and mobile layout',
  )
} finally {
  await browser.close()
  sql(`DELETE FROM private.churches WHERE id='${church}'`)
  for (const id of users) sql(`DELETE FROM public.users WHERE id='${id}'`)
}
