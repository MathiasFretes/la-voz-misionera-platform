import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, mkdir, realpath, rm } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from '@playwright/test'

// Browser uses the real HTTPS origin, local production assets and an SSH-only isolated VPS API.
const origin = 'https://srv2137598.hstgr.cloud'
const production = process.env.LVM_PLANNING_TARGET === 'production'
const backend = production
  ? origin
  : process.env.LVM_PLANNING_QA_API || 'http://127.0.0.1:54319'
const database = production ? 'lvm_worship' : 'lvm_planning_qa_20261121'
const run = randomUUID()
const assets = resolve('dist')
const headers = { Origin: origin, 'Content-Type': 'application/json' }
const users = []
const churches = [randomUUID(), randomUUID()]
const errors = []
const profiles = new Map()
let context
const controls = {
  offline: false,
  holdTitle: '',
  release: null,
  started: null,
  dropTitle: '',
  droppedOperation: null,
  calls: [],
}
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
  ).trim()
}
async function api(
  path,
  actor,
  data,
  method = data === undefined ? 'GET' : 'POST',
  operationId,
) {
  const response = await fetch(`${backend}/api/${path}`, {
    method,
    headers: {
      ...headers,
      ...(actor ? { Cookie: actor.cookie, 'X-LVM-Account': actor.id } : {}),
      ...(operationId ? { 'X-LVM-Operation': operationId } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  const text = await response.text()
  return {
    status: response.status,
    data: text ? JSON.parse(text) : null,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  }
}
async function account(label) {
  const result = await api('auth/signup', null, {
    email: `planning-ui-${label}-${run}@example.com`,
    password: randomUUID(),
    options: { data: { full_name: `Planning QA ${label}` } },
  })
  assert.equal(result.status, 201, JSON.stringify(result.data))
  users.push(result.data.user.id)
  return { ...result.data.user, cookie: result.cookie }
}
const rpc = async (name, actor, data) => {
  const result = await api(`data/rpc/${name}`, actor, data)
  assert.equal(result.status, 200, JSON.stringify(result.data))
  return result.data
}
async function eventually(check, message, timeout = 15000) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if (await check()) return
    await delay(120)
  }
  throw new Error(message)
}
async function routes(target) {
  if (!production)
    await target.route(`${origin}/service**`, async (route) => {
      const pathname = new URL(route.request().url()).pathname
      const relative = pathname.startsWith('/service/assets/')
        ? pathname.slice('/service/'.length)
        : 'index.html'
      const file = resolve(assets, relative)
      assert.ok(file.startsWith(assets + sep))
      const mime =
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
        }[extname(file)] || 'application/octet-stream'
      await route.fulfill({
        status: 200,
        contentType: mime,
        body: await readFile(file),
      })
    })
  await target.route(`${origin}/api/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const planning = url.pathname.startsWith('/api/churches/')
    if (planning && controls.offline) return route.abort('internetdisconnected')
    const forwarded = Object.fromEntries(
      Object.entries(request.headers()).filter(([name]) =>
        [
          'origin',
          'cookie',
          'content-type',
          'x-lvm-account',
          'x-lvm-operation',
        ].includes(name),
      ),
    )
    const result = await fetch(`${backend}${url.pathname}${url.search}`, {
      method: request.method(),
      headers: forwarded,
      body: ['GET', 'HEAD'].includes(request.method())
        ? undefined
        : request.postDataBuffer(),
    })
    const text = await result.text()
    const title =
      request.method() === 'PUT'
        ? JSON.parse(request.postData() || '{}').service?.title
        : ''
    if (planning && request.method() !== 'GET')
      controls.calls.push({
        id: forwarded['x-lvm-operation'],
        method: request.method(),
        title,
        status: result.status,
      })
    if (title && title === controls.dropTitle) {
      controls.droppedOperation = forwarded['x-lvm-operation']
      controls.dropTitle = ''
      return route.abort('connectionreset')
    }
    if (title && title === controls.holdTitle) {
      controls.holdTitle = ''
      await new Promise((resolve) => {
        controls.release = resolve
        controls.started?.()
      })
    }
    try {
      await route.fulfill({
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...(result.headers.get('set-cookie')
            ? { 'set-cookie': result.headers.get('set-cookie') }
            : {}),
        },
        body: text,
      })
    } catch (error) {
      if (
        !/closed|disposed|interception|Invalid Interception/i.test(
          error.message,
        )
      )
        throw error
    }
  })
}
async function authenticated(
  actor,
  profile = resolve('test-results/planning', `browser-profile-${randomUUID()}`),
  preserveCookies = false,
) {
  await mkdir(profile, { recursive: true })
  const target = await chromium.launchPersistentContext(profile, {
    headless: true,
    viewport: { width: 1440, height: 1000 },
  })
  await routes(target)
  profiles.set(target, profile)
  if (!preserveCookies)
    await target.addCookies([
      {
        name: '__Host-lvm_session',
        value: actor.cookie.split('=')[1],
        url: origin,
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
        expires: Date.now() / 1000 + 604800,
      },
    ])
  target.on('page', (page) =>
    page.on('pageerror', (error) => errors.push(error.message)),
  )
  return target
}
const list = async (actor, church) => {
  const result = await api(`churches/${church}/services`, actor)
  assert.equal(result.status, 200, JSON.stringify(result.data))
  return result.data
}
async function choose(page, church) {
  await page
    .getByRole('combobox', { name: 'Iglesia de planificación' })
    .selectOption(church)
  await page.getByRole('heading', { name: 'Servicios', exact: true }).waitFor()
}
async function create(page, title) {
  await page
    .getByRole('link', { name: '+ Crear servicio', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(title)
  await page
    .getByRole('button', { name: 'Crear servicio', exact: true })
    .click()
  await page.getByRole('heading', { name: title, exact: true }).waitFor()
  return new URL(page.url()).pathname.split('/').at(-1)
}
async function editTitle(page, title) {
  await page.getByRole('tab', { name: 'Información', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(title)
}
try {
  assert.equal((await api('health')).status, 200)
  const global = await account('global')
  const leader = await account('leader')
  const viewer = await account('viewer')
  const outsider = await account('outsider')
  for (const user of users) assert.match(user, /^[a-f0-9-]{36}$/)
  sql(`UPDATE public.users SET role='admin' WHERE id='${global.id}'`)
  for (const [index, id] of churches.entries())
    await rpc('save_church', global, {
      p_id: id,
      p_name: `QA Iglesia ${index + 1}`,
      p_status: 'active',
      p_expected_revision: 0,
    })
  for (const [actor, church, role] of [
    [leader, churches[0], 'leader'],
    [leader, churches[1], 'leader'],
    [viewer, churches[0], 'viewer'],
    [outsider, churches[1], 'leader'],
  ]) {
    await rpc('save_church_membership', global, {
      p_church_id: church,
      p_user_id: actor.id,
      p_role: role,
      p_status: 'active',
      p_expected_revision: 0,
    })
  }
  context = await authenticated(leader)
  let page = await context.newPage()
  await page.goto(`${origin}/service/services`, {
    waitUntil: 'domcontentloaded',
  })
  await choose(page, churches[0])
  await page
    .getByText('Servicios sincronizados con PostgreSQL.', { exact: true })
    .waitFor()
  // Pause only debounce timers so this case proves cancellation before any request starts.
  await page.clock.install({ time: new Date('2026-11-21T12:30:00Z') })
  await page.clock.pauseAt(new Date('2026-11-21T12:30:01Z'))
  const neverSent = await create(page, `Cancelar antes de enviar ${run}`)
  await page
    .getByRole('button', { name: 'Eliminar servicio', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Confirmar eliminación', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Servicios', exact: true }).waitFor()
  await page
    .getByText('Servicios sincronizados con PostgreSQL.', { exact: true })
    .waitFor()
  await page.clock.resume()
  await delay(500)
  assert.equal(
    (await list(leader, churches[0])).some((record) => record.id === neverSent),
    false,
  )
  assert.equal(
    sql(
      `SELECT count(*) FROM private.service_plan_history WHERE church_id='${churches[0]}' AND service_id='${neverSent}'`,
    ),
    '0',
  )
  controls.offline = true
  await context.setOffline(true)
  const offlineTitle = `Culto sin red ${run}`
  const id = await create(page, offlineTitle)
  await page
    .getByRole('button', { name: 'Reintentar sincronización' })
    .waitFor()
  assert.equal((await list(leader, churches[0])).length, 0)
  const editorUrl = page.url()
  const profile = profiles.get(context)
  await context.close()
  context = await authenticated(leader, profile, true)
  page = await context.newPage()
  await page.goto(editorUrl, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: offlineTitle, exact: true }).waitFor()
  await page
    .getByRole('button', { name: 'Reintentar sincronización' })
    .waitFor()
  controls.offline = false
  await page.getByRole('button', { name: 'Reintentar sincronización' }).click()
  await eventually(
    async () =>
      (await list(leader, churches[0])).some((record) => record.id === id),
    'Offline draft did not synchronize',
  )
  await page
    .getByText('Servicios sincronizados con PostgreSQL.', { exact: true })
    .waitFor()
  const oldTitle = `Respuesta retenida ${run}`
  const newTitle = `Título más reciente ${run}`
  controls.holdTitle = oldTitle
  const started = new Promise((resolve) => {
    controls.started = resolve
  })
  await editTitle(page, oldTitle)
  await Promise.race([
    started,
    delay(15000).then(() => {
      throw new Error('The held write did not start')
    }),
  ])
  await editTitle(page, newTitle)
  await page.getByRole('heading', { name: newTitle, exact: true }).waitFor()
  controls.release()
  await eventually(
    async () =>
      (await list(leader, churches[0])).find((record) => record.id === id)
        ?.service.title === newTitle,
    'Late response lost the newer edit',
  )
  await page.getByRole('heading', { name: newTitle, exact: true }).waitFor()
  controls.dropTitle = `Confirmación perdida ${run}`
  await editTitle(page, controls.dropTitle)
  await page
    .getByRole('button', { name: 'Reintentar sincronización' })
    .waitFor()
  const history = sql(
    `SELECT count(*) FROM private.service_plan_history WHERE church_id='${churches[0]}' AND service_id='${id}'`,
  )
  await page.getByRole('button', { name: 'Reintentar sincronización' }).click()
  await page
    .getByText('Servicios sincronizados con PostgreSQL.', { exact: true })
    .waitFor()
  assert.equal(
    sql(
      `SELECT count(*) FROM private.service_plan_history WHERE church_id='${churches[0]}' AND service_id='${id}'`,
    ),
    history,
  )
  assert.ok(
    controls.calls.filter((call) => call.id === controls.droppedOperation)
      .length >= 2,
  )
  // A remote writer forces a real PostgreSQL revision conflict.
  const remote = (await list(global, churches[0])).find(
    (record) => record.id === id,
  )
  const external = await api(
    `churches/${churches[0]}/services/${id}`,
    global,
    {
      ...remote,
      service: { ...remote.service, title: 'Cambio desde otra sesión' },
    },
    'PUT',
    randomUUID(),
  )
  assert.equal(external.status, 200)
  const localTitle = `Conservar esta copia ${run}`
  await editTitle(page, localTitle)
  await page
    .getByRole('heading', { name: 'Cambios en conflicto', exact: true })
    .waitFor()
  await page
    .getByRole('heading', { name: localTitle, exact: true, level: 1 })
    .waitFor()
  await page
    .getByRole('button', { name: 'Conservar mi versión', exact: true })
    .click()
  await eventually(
    async () =>
      (await list(global, churches[0])).find((record) => record.id === id)
        ?.service.title === localTitle,
    'Explicit conflict resolution failed',
  )
  const second = await context.newPage()
  await Promise.all([
    page.goto(`${origin}/service/services`, { waitUntil: 'domcontentloaded' }),
    second.goto(`${origin}/service/services`, {
      waitUntil: 'domcontentloaded',
    }),
  ])
  await Promise.all([choose(page, churches[0]), choose(second, churches[0])])
  const [a, b] = await Promise.all([
    create(page, `Pestaña A ${run}`),
    create(second, `Pestaña B ${run}`),
  ])
  assert.notEqual(a, b)
  await eventually(async () => {
    const rows = await list(leader, churches[0])
    return rows.some((r) => r.id === a) && rows.some((r) => r.id === b)
  }, 'Concurrent tabs lost one of the drafts')
  await page.goto(`${origin}/service/services/${id}`, {
    waitUntil: 'domcontentloaded',
  })
  const scopeTitle = `Respuesta pendiente de iglesia A ${run}`
  controls.holdTitle = scopeTitle
  const scopeStarted = new Promise((resolve) => {
    controls.started = resolve
  })
  await editTitle(page, scopeTitle)
  await Promise.race([
    scopeStarted,
    delay(15000).then(() => {
      throw new Error('The held church write did not start')
    }),
  ])
  await page
    .getByRole('combobox', { name: 'Iglesia de planificación' })
    .selectOption(churches[1])
  controls.release()
  await page.goto(`${origin}/service/services`, {
    waitUntil: 'domcontentloaded',
  })
  await choose(page, churches[1])
  assert.equal(
    await page.getByRole('heading', { name: localTitle, exact: true }).count(),
    0,
  )
  assert.equal(
    await page.getByRole('heading', { name: scopeTitle, exact: true }).count(),
    0,
  )
  assert.equal(
    (await api(`churches/${churches[0]}/services`, outsider)).status,
    403,
  )
  await mkdir('test-results/planning', { recursive: true })
  await page.screenshot({
    path: 'test-results/planning/church-selector-desktop.png',
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
    path: 'test-results/planning/church-selector-mobile.png',
    fullPage: true,
  })
  // Revoke the writer while its original browser session remains active.
  await page.goto(`${origin}/service/services/${id}`, {
    waitUntil: 'domcontentloaded',
  })
  await page
    .getByRole('combobox', { name: 'Iglesia de planificación' })
    .selectOption(churches[0])
  await page
    .getByRole('heading', { name: scopeTitle, exact: true, level: 1 })
    .waitFor()
  await rpc('save_church_membership', global, {
    p_church_id: churches[0],
    p_user_id: leader.id,
    p_role: 'viewer',
    p_status: 'active',
    p_expected_revision: 1,
  })
  await editTitle(page, `Sin permiso ${run}`)
  await eventually(
    async () =>
      controls.calls.some(
        (call) => call.title === `Sin permiso ${run}` && call.status === 403,
      ),
    'Revoked writer was not rejected',
  )
  assert.equal(
    (await list(global, churches[0])).find((record) => record.id === id).service
      .title,
    scopeTitle,
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page
    .getByText('Consulta · sin permisos de edición', { exact: true })
    .waitFor()
  await page
    .getByText(
      'Los cambios pendientes se conservan en este dispositivo. No se enviarán mientras tu cuenta no tenga permiso de edición.',
      { exact: true },
    )
    .waitFor()
  const downloadPending = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Descargar borrador local', exact: true })
    .click()
  const downloaded = await downloadPending
  const draftPath = resolve('test-results/planning', 'revoked-local-draft.json')
  await downloaded.saveAs(draftPath)
  assert.equal(
    JSON.parse(await readFile(draftPath, 'utf8')).service.title,
    `Sin permiso ${run}`,
  )
  assert.equal(
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).count(),
    0,
  )
  await context.close()
  context = await authenticated(viewer)
  const readOnly = await context.newPage()
  await readOnly.goto(`${origin}/service/services`, {
    waitUntil: 'domcontentloaded',
  })
  await readOnly
    .getByRole('heading', { name: 'Servicios', exact: true })
    .waitFor()
  assert.equal(
    await readOnly
      .getByRole('link', { name: '+ Crear servicio', exact: true })
      .count(),
    0,
  )
  assert.deepEqual(errors, [])
  console.log(
    `PASS: ${production ? 'deployed HTTPS Service and VPS API/PostgreSQL' : 'production UI with isolated VPS API/PostgreSQL'}; unsent creation cancelled with zero server writes, offline create/full browser restart/reconnect, delayed response, lost acknowledgement with one history revision, real 409 and explicit resolution, two tabs, church switching with a response pending, tenant isolation, live revocation, read-only UI and mobile layout`,
  )
} finally {
  controls.release?.()
  await context?.close()
  for (const id of churches)
    sql(`DELETE FROM private.churches WHERE id='${id}'`)
  for (const id of users) sql(`DELETE FROM public.users WHERE id='${id}'`)
  const artifactRoot = await realpath(resolve('test-results/planning'))
  for (const profile of new Set(profiles.values())) {
    const actual = await realpath(profile)
    assert.ok(
      actual.startsWith(artifactRoot + sep) &&
        actual.includes('browser-profile-'),
      'Only this verifier’s browser profiles may be removed',
    )
    await rm(actual, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    })
  }
}
