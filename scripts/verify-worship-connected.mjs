import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
const origin = 'https://srv2137598.hstgr.cloud'
const production = process.env.LVM_WORSHIP_TARGET === 'production'
// Preflight checks local client builds against the published API using its own
// temporary fixtures, without replacing the deployed interfaces.
const publishedApi =
  production || process.env.LVM_WORSHIP_TARGET === 'preflight'
const backend = publishedApi ? origin : 'http://127.0.0.1:54319'
const database = publishedApi ? 'lvm_worship' : 'lvm_planning_qa_20261121'
const roots = {
  service: resolve('dist'),
  worship: resolve('../LVM Worship/apps/web/dist'),
}
const church = randomUUID(),
  serviceId = randomUUID(),
  songId = randomUUID()
const users = []
let offline = false
const browser = await chromium.launch({ headless: true })
const errors = []
function sql(statement) {
  return execFileSync(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      'hostinger-vps',
      `cd /srv/apps/la-voz-misionera && docker compose exec -T postgres psql -U lvm_owner -d ${database} -v ON_ERROR_STOP=1 -Atc "${statement}"`,
    ],
    { encoding: 'utf8' },
  )
}
async function api(
  path,
  actor,
  input,
  method = input === undefined ? 'GET' : 'POST',
  operation,
) {
  const response = await fetch(`${backend}/api/${path}`, {
    method,
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      ...(actor ? { Cookie: actor.cookie, 'X-LVM-Account': actor.id } : {}),
      ...(operation ? { 'X-LVM-Operation': operation } : {}),
    },
    body: input === undefined ? undefined : JSON.stringify(input),
  })
  const text = await response.text()
  return {
    status: response.status,
    result: text ? JSON.parse(text) : null,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  }
}
const ok = (result) => {
  assert.equal(result.status, 200, JSON.stringify(result.result))
  return result.result
}
async function user(label) {
  const response = await api('auth/signup', null, {
    email: `connected-qa-${label}-${randomUUID()}@example.com`,
    password: randomUUID(),
  })
  assert.equal(response.status, 201)
  users.push(response.result.user.id)
  return { id: response.result.user.id, cookie: response.cookie }
}
async function context(actor) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
  })
  await context.addInitScript(() =>
    globalThis.localStorage.setItem('lvm.uiLanguage', 'es'),
  )
  await context.route(`${origin}/**`, async (route) => {
    const request = route.request(),
      url = new URL(request.url())
    if (url.pathname.startsWith('/api/')) {
      if (
        offline &&
        url.pathname.includes('/worship') &&
        request.method() === 'PUT'
      )
        return route.abort('internetdisconnected')
      if (publishedApi) return route.continue()
      const headers = Object.fromEntries(
        Object.entries(request.headers()).filter(([name]) =>
          [
            'cookie',
            'origin',
            'content-type',
            'x-lvm-account',
            'x-lvm-operation',
            'prefer',
            'accept',
          ].includes(name),
        ),
      )
      const response = await fetch(`${backend}${url.pathname}${url.search}`, {
        method: request.method(),
        headers,
        body: request.method() === 'GET' ? undefined : request.postDataBuffer(),
      })
      return route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: await response.text(),
      })
    }
    if (production) return route.continue()
    const service = url.pathname.startsWith('/service/')
    const root = service ? roots.service : roots.worship
    const relative = service
      ? url.pathname.startsWith('/service/assets/')
        ? url.pathname.slice('/service/'.length)
        : 'index.html'
      : url.pathname.startsWith('/assets/') ||
          url.pathname.startsWith('/fonts/')
        ? url.pathname.slice(1)
        : 'index.html'
    const file = resolve(root, relative)
    assert.ok(file.startsWith(root + sep))
    try {
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
    } catch {
      await route.fulfill({ status: 404, body: '' })
    }
  })
  await context.addCookies([
    {
      name: '__Host-lvm_session',
      value: actor.cookie.split('=')[1],
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
  const admin = await user('admin'),
    musician = await user('musician')
  sql(`UPDATE public.users SET role='admin' WHERE id='${admin.id}'`)
  ok(
    await api('data/rpc/save_church', admin, {
      p_id: church,
      p_name: 'Iglesia conectada QA',
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
  const insertSong = await api(
    'data/songs',
    admin,
    {
      id: songId,
      slug: `canto-qa-${songId}`,
      title: 'Canto de prueba QA',
      artist: 'QA',
      default_key: 'G',
      chordpro_content:
        '{title: Canto de prueba QA}\n{key: G}\n{start_of_verse}\n[G]Cantamos juntos\n{end_of_verse}',
    },
    'POST',
  )
  assert.equal(insertSong.status, 201, JSON.stringify(insertSong.result))
  const path = `churches/${church}/services/${serviceId}`
  ok(
    await api(
      path,
      admin,
      {
        id: serviceId,
        venue: 'Central',
        worshipAfterItemId: 'welcome',
        service: {
          schemaVersion: '0.1',
          id: serviceId,
          title: 'Culto conectado QA',
          startsAt: '2026-12-01T12:00:00Z',
          setlist: { id: 'set-qa', name: 'Adoración QA' },
          items: [
            {
              id: 'welcome',
              kind: 'ANNOUNCEMENT',
              announcement: { title: 'Bienvenida QA', body: 'Comunidad' },
            },
          ],
        },
      },
      'PUT',
      randomUUID(),
    ),
  )
  const page = await context(musician)
  await page.goto(`${origin}/service/services/${serviceId}`, {
    waitUntil: 'domcontentloaded',
  })
  await page
    .getByRole('link', { name: 'Preparar en Worship', exact: true })
    .click()
  await page.waitForURL('**/setlist?*')
  await page
    .getByRole('button', { name: /^Canto de prueba QA/ })
    .first()
    .click()
  const connected = page.getByRole('region', {
    name: 'LVM Service',
    exact: true,
  })
  await connected
    .getByText('Preparando repertorio para Culto conectado QA', { exact: true })
    .waitFor()
  offline = true
  await connected.getByRole('button', { name: 'Guardar', exact: true }).click()
  await connected
    .getByText('Guardado en este dispositivo', { exact: true })
    .waitFor()
  assert.equal(ok(await api(`${path}/worship`, admin)).revision, 0)
  const initial = await page.evaluate(() =>
    Object.keys(globalThis.localStorage)
      .filter(
        (key) =>
          key.startsWith('lvm.worship.service-draft.v1:') &&
          key.endsWith(':exchange'),
      )
      .map((key) => JSON.parse(globalThis.localStorage.getItem(key)))
      .find((entry) => entry.pending),
  )
  assert.ok(initial.pending.id)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await connected
    .getByRole('button', { name: 'Guardar', exact: true })
    .waitFor()
  await connected
    .getByText('Guardado en este dispositivo', { exact: true })
    .waitFor()
  offline = false
  await page.evaluate(() =>
    globalThis.dispatchEvent(new globalThis.Event('online')),
  )
  await connected.getByText('Repertorio guardado.', { exact: true }).waitFor()
  const proposal = ok(await api(`${path}/worship`, admin))
  assert.equal(proposal.revision, 1)
  assert.equal(proposal.plan.songs[0].title, 'Canto de prueba QA')
  assert.equal(
    proposal.plan.songs[0].sections[0].lines[0].text,
    'Cantamos juntos',
  )
  const planner = await context(admin)
  await planner.goto(`${origin}/service/services`, {
    waitUntil: 'domcontentloaded',
  })
  await planner
    .getByRole('combobox', { name: 'Iglesia de planificación' })
    .selectOption(church)
  await planner.goto(`${origin}/service/services/${serviceId}`, {
    waitUntil: 'domcontentloaded',
  })
  const review = planner.getByRole('region', {
    name: 'Repertorio conectado de Worship',
  })
  await review.getByText('Canto de prueba QA', { exact: true }).waitFor()
  await review.getByRole('button', { name: 'Revisar incorporación' }).click()
  await review.getByRole('button', { name: 'Confirmar incorporación' }).click()
  await review
    .getByText('Esta propuesta ya fue incorporada al culto.', { exact: true })
    .waitFor()
  const merged = ok(await api(`churches/${church}/services`, admin))[0]
  assert.deepEqual(
    merged.service.items.map((item) => item.kind),
    ['ANNOUNCEMENT', 'SONG'],
  )
  assert.equal(merged.service.items[0].announcement.title, 'Bienvenida QA')
  const { serviceToProject } = await import(
    pathToFileURL(resolve('../LVM Presenter/src/lvm/serviceToProject.mjs')).href
  )
  const converted = serviceToProject(merged.service)
  assert.deepEqual(
    converted.project.shows.map((show) => show.data.lvmServiceKind),
    ['ANNOUNCEMENT', 'SONG'],
  )
  assert.equal(
    converted.shows[converted.project.shows[1].id].name,
    'Canto de prueba QA',
  )
  const freshDevice = await context(musician)
  await freshDevice.goto(
    `${origin}/setlist?churchId=${church}&serviceId=${serviceId}`,
    { waitUntil: 'domcontentloaded' },
  )
  const freshEditor = freshDevice.getByRole('region', { name: 'LVM Service' })
  await freshEditor
    .getByRole('button', {
      name: 'Editar: Repertorio para LVM Service',
      exact: true,
    })
    .click()
  await freshDevice.waitForFunction(() =>
    Object.entries(globalThis.localStorage).some(
      ([key, value]) =>
        key.startsWith('lvm.worship.service-draft.v1:') &&
        !key.endsWith(':exchange') &&
        JSON.parse(value).entries.length === 1,
    ),
  )
  const recovered = await freshDevice.evaluate(() =>
    Object.entries(globalThis.localStorage)
      .filter(
        ([key]) =>
          key.startsWith('lvm.worship.service-draft.v1:') &&
          !key.endsWith(':exchange'),
      )
      .map(([, value]) => JSON.parse(value)),
  )
  assert.ok(
    recovered.some((draft) => draft.entries.length === 0),
    'Previous local branch is preserved',
  )
  assert.equal(
    recovered.find((draft) => draft.entries.length).entries[0].sourceSong.title,
    'Canto de prueba QA',
  )
  await freshDevice
    .getByText('Canto de prueba QA', { exact: true })
    .first()
    .waitFor()
  const returnPath = await freshEditor
    .getByRole('link', { name: 'Volver a LVM Service' })
    .getAttribute('href')
  assert.equal(new URL(returnPath, origin).searchParams.get('churchId'), church)
  const returning = await context(admin)
  await returning.addInitScript(
    (userId) =>
      globalThis.localStorage.setItem(
        `lvm.service.selected-church.${userId}`,
        'legacy',
      ),
    admin.id,
  )
  await returning.goto(new URL(returnPath, origin).href, {
    waitUntil: 'domcontentloaded',
  })
  await returning
    .getByRole('region', { name: 'Repertorio conectado de Worship' })
    .getByText('Canto de prueba QA', { exact: true })
    .waitFor()
  assert.equal(
    await returning
      .getByRole('combobox', { name: 'Iglesia de planificación' })
      .inputValue(),
    church,
  )
  const invalid = await context(admin)
  await invalid.goto(
    `${origin}/service/services/${serviceId}?churchId=${randomUUID()}`,
    { waitUntil: 'domcontentloaded' },
  )
  await invalid
    .getByRole('alert')
    .getByText('La iglesia del enlace no está disponible para tu cuenta.')
    .waitFor()
  assert.equal(
    await invalid
      .getByRole('combobox', { name: 'Iglesia de planificación' })
      .inputValue(),
    '',
  )
  await mkdir('test-results/worship-exchange', { recursive: true })
  await planner.screenshot({
    path: 'test-results/worship-exchange/connected-service-review.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  )
  await page.screenshot({
    path: 'test-results/worship-exchange/connected-worship-mobile.png',
    fullPage: true,
  })
  assert.deepEqual(errors, [])
  console.log(
    'PASS: real Service → Worship editor → queued proposal after reload/reconnection → Service review/application → canonical Presenter conversion; fresh-device proposal recovery preserves the previous draft. Desktop Presenter delivery and full offline network loss are separate gates.',
  )
} catch (error) {
  await mkdir('test-results/worship-exchange', { recursive: true })
  for (const [index, current] of browser
    .contexts()
    .flatMap((context) => context.pages())
    .entries()) {
    await current
      .screenshot({
        path: `test-results/worship-exchange/failure-${index}.png`,
        fullPage: true,
      })
      .catch(() => {})
    console.error(
      current.url(),
      (
        await current
          .locator('body')
          .innerText()
          .catch(() => '')
      ).slice(0, 5000),
    )
  }
  console.error('Browser errors:', errors)
  throw error
} finally {
  await browser.close()
  sql(`DELETE FROM private.churches WHERE id='${church}'`)
  sql(`DELETE FROM public.songs WHERE id='${songId}'`)
  for (const id of users) sql(`DELETE FROM public.users WHERE id='${id}'`)
}
