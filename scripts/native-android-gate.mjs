import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { dirname, resolve } from 'node:path'
import { applyWorshipPlan } from '../suite-api/worship-contract.mjs'
import { validateServiceRecord } from '../suite-api/service-record.mjs'
import {
  loadNativeGateContext,
  redactNativeGateFailure,
} from './native-gate-context.mjs'
import {
  validateQaDeviceSerial,
  verifyQaApk,
} from './native-android-device.mjs'
import { verifyNativeQaTls } from './native-qa-tls.mjs'

// Fixture credentials stay in this process. The interactive protocol exposes
// only test IDs, scoped UI metadata and assertions, never passwords/tokens.
const serial = validateQaDeviceSerial(process.env.LVM_NATIVE_QA_SERIAL)
const { manifest, sql } = await loadNativeGateContext()
assert.ok(manifest.android, 'Physical QA requires the live Android TLS gate')
const api = manifest.apiUrl
const database = manifest.database.name
const pkg = 'com.lavozmisionera.qa'
assert.equal(
  process.argv.length,
  2,
  'Historical fixture resume is not supported',
)
const run = randomUUID()
const output = resolve(dirname(process.env.LVM_NATIVE_GATE_MANIFEST), 'android')
const build = JSON.parse(
  await readFile(resolve(output, 'android-build-manifest.json'), 'utf8'),
)
const apk = resolve(output, 'app-debug.apk')
verifyQaApk(manifest, build, await readFile(apk))
await verifyNativeQaTls({
  port: manifest.android.localTlsPort,
  runId: manifest.runId,
  ca: await readFile(manifest.android.caPath),
})
await mkdir(output, { recursive: true })
const users = []
const churches = [randomUUID(), randomUUID()]
const songIds = [randomUUID(), randomUUID()]
const actors = {}
const report = {
  run,
  clientCommit: manifest.client.commit,
  apiCommit: manifest.server.commit,
  gateRunId: manifest.runId,
  apkSha256: build.apk.sha256,
  serial,
  database,
  applicationId: pkg,
  observations: [],
  complete: false,
}
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`
function adb(...args) {
  try {
    return execFileSync(process.env.LVM_ADB || 'adb', ['-s', serial, ...args], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    })
  } catch {
    throw new Error('ADB operation failed; no command arguments logged')
  }
}
const shell = (...args) => adb('shell', args.map(quote).join(' '))
function releaseQaReverse() {
  const mapping = adb('reverse', '--list')
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .find((fields) => fields[1] === 'tcp:8443')
  if (!mapping) return
  assert.equal(
    mapping[2],
    `tcp:${manifest.android.localTlsPort}`,
    'Refusing to remove another reverse mapping',
  )
  adb('reverse', '--remove', 'tcp:8443')
}
const parseNodes = (xml) =>
  [...xml.matchAll(/<node\b[^>]*>/g)]
    .map((match) =>
      Object.fromEntries(
        [...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [
          name,
          value
            .replaceAll('&amp;', '&')
            .replaceAll('&quot;', '"')
            .replaceAll('&lt;', '<')
            .replaceAll('&gt;', '>'),
        ]),
      ),
    )
    .filter((node) => node.package === pkg)
function nodes() {
  const focus =
    shell('dumpsys', 'window')
      .split('\n')
      .find((line) => line.includes('mCurrentFocus')) || ''
  assert.ok(
    focus.includes(pkg),
    'QA app must be foreground before reading or controlling UI',
  )
  shell('uiautomator', 'dump', '/sdcard/lvm-native-qa-window.xml')
  return parseNodes(shell('cat', '/sdcard/lvm-native-qa-window.xml'))
}
function tap(node) {
  assert.ok(node, 'Requested QA control is not visible')
  const bounds = node.bounds.match(/\d+/g).map(Number)
  shell(
    'input',
    'tap',
    String(Math.round((bounds[0] + bounds[2]) / 2)),
    String(Math.round((bounds[1] + bounds[3]) / 2)),
  )
}
async function call(actor, path, method = 'GET', body, operation) {
  const result = await fetch(`${api}${path}`, {
    method,
    headers: {
      'X-LVM-Client': 'native',
      ...(actor
        ? { Authorization: `Bearer ${actor.token}`, 'X-LVM-Account': actor.id }
        : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(operation ? { 'X-LVM-Operation': operation } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: result.status, data: await result.json() }
}
async function rpc(name, body) {
  const result = await call(actors.admin, `/data/rpc/${name}`, 'POST', body)
  assert.equal(result.status, 200, name)
  return result.data
}
async function account(label) {
  const email = `native-android-${label}-${run}@example.com`
  const password = randomUUID()
  const result = await call(null, '/native/auth/signup', 'POST', {
    email,
    password,
  })
  assert.equal(result.status, 201)
  const actor = {
    id: result.data.user.id,
    token: result.data.session.access_token,
    email,
    password,
  }
  users.push(actor.id)
  await saveReport()
  return actor
}
function service(index) {
  const id = `native-android-${run}-${index}`
  return {
    id,
    venue: 'QA',
    worshipAfterItemId: 'welcome',
    service: {
      schemaVersion: '0.1',
      id,
      title: index ? 'Otro culto Android QA' : 'Culto Android QA',
      startsAt: '2026-12-01T12:00:00Z',
      setlist: { id: `set-${id}`, name: 'Ensayo Android QA' },
      items: [
        {
          id: 'welcome',
          kind: 'ANNOUNCEMENT',
          announcement: { title: 'Bienvenida Android QA', body: 'Comunidad' },
        },
        {
          id: 'message',
          kind: 'SERMON',
          sermon: { title: 'Mensaje Android QA', body: 'Esperanza' },
        },
      ],
    },
  }
}
const path = (index) =>
  `/churches/${churches[index]}/services/${service(index).id}`
const uri = (index) =>
  `lavozmisionera://setlist/service?churchId=${churches[index]}&serviceId=${service(index).id}`
const snapshot = () =>
  JSON.parse(
    sql(
      `SELECT jsonb_build_object('proposal',(SELECT jsonb_build_object('revision',revision,'plan',plan,'serviceRevision',based_on_service_revision) FROM private.worship_plans WHERE church_id=${literal(churches[0])} AND service_id=${literal(service(0).id)}),'history',(SELECT count(*) FROM private.worship_plan_history WHERE church_id=${literal(churches[0])}),'operations',(SELECT jsonb_agg(operation_id) FROM private.service_plan_operations WHERE church_id=${literal(churches[0])}),'serviceRevision',(SELECT revision FROM private.service_plans WHERE church_id=${literal(churches[0])} AND id=${literal(service(0).id)}));`,
    ),
  )
const saveReport = async () => {
  report.fixtures = {
    users: [...users],
    churches: [...churches],
    songs: [...songIds],
  }
  const value = JSON.stringify(report, null, 2) + '\n'
  await writeFile(resolve(output, `android-observations-${run}.json`), value)
  await writeFile(resolve(output, 'android-observations.json'), value)
}

assert.equal(sql('SELECT current_database();'), database)
assert.equal(
  sql('SELECT count(*) FROM public.users;'),
  '0',
  'Physical gate requires empty disposable fixtures',
)
assert.equal(adb('get-state').trim(), 'device')
const mappings = adb('reverse', '--list')
assert.ok(
  !mappings.split(/\r?\n/).some((line) => line.split(/\s+/)[1] === 'tcp:8443'),
  'Existing ADB reverse mapping must not be replaced',
)
adb('install', '-r', apk)
const installedPath = shell('pm', 'path', pkg)
  .trim()
  .split(/\r?\n/)
  .find((line) => line.startsWith('package:'))
  ?.slice(8)
assert.ok(installedPath, 'QA package was not installed')
const installedApk = execFileSync(
  process.env.LVM_ADB || 'adb',
  ['-s', serial, 'exec-out', 'cat', installedPath],
  { maxBuffer: 256 * 1024 * 1024 },
)
assert.equal(
  createHash('sha256').update(installedApk).digest('hex'),
  build.apk.sha256,
)
report.installedApkVerified = true
let reverseOwned = false
await saveReport()
try {
  adb('reverse', 'tcp:8443', `tcp:${manifest.android.localTlsPort}`)
  reverseOwned = true
  {
    actors.admin = await account('admin')
    actors.musician = await account('musician')
    actors.other = await account('other')
    sql(
      `UPDATE public.users SET role='admin' WHERE id=${literal(actors.admin.id)};`,
    )
    for (let index = 0; index < churches.length; index++) {
      await rpc('save_church', {
        p_id: churches[index],
        p_name: index ? 'Otra iglesia Android QA' : 'Iglesia Android QA',
        p_status: 'active',
        p_expected_revision: 0,
      })
      await rpc('save_church_membership', {
        p_church_id: churches[index],
        p_user_id: index ? actors.other.id : actors.musician.id,
        p_role: 'member',
        p_status: 'active',
        p_expected_revision: 0,
      })
      assert.equal(
        (
          await call(
            actors.admin,
            path(index),
            'PUT',
            service(index),
            randomUUID(),
          )
        ).status,
        200,
      )
    }
    for (const [index, [title, key, chart]] of [
      ['Alba Android QA', 'D', '{key:D}\n[D]Sale el sol 😀 [A]hoy'],
      ['Fidelidad Android QA', 'C', '{key:C}\n[C]Tu [G]fidelidad'],
    ].entries())
      sql(
        `INSERT INTO public.songs(id,slug,title,default_key,chordpro_content,created_by) VALUES(${literal(songIds[index])},${literal(`native-android-${index}-${run}`)},${literal(title)},${literal(key)},${literal(chart)},${literal(actors.admin.id)});`,
      )
  }
} catch (error) {
  sql(
    `DELETE FROM private.churches WHERE id IN (${churches.map(literal).join(',')}); DELETE FROM public.songs WHERE id IN (${songIds.map(literal).join(',')});`,
  )
  if (users.length)
    sql(
      `DELETE FROM public.users WHERE id IN (${users.map(literal).join(',')});`,
    )
  if (reverseOwned) {
    releaseQaReverse()
    reverseOwned = false
  }
  report.interrupted = true
  report.fixturesCleaned = true
  await saveReport()
  throw error
}
console.log(
  JSON.stringify({
    ready: true,
    run,
    musicianId: actors.musician.id,
    otherId: actors.other.id,
    links: [uri(0), uri(1)],
  }),
)

async function command(value) {
  if (value.action === 'open')
    return shell(
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      value.settings ? 'lavozmisionera://profile' : uri(value.index || 0),
      '-p',
      pkg,
    )
  if (value.action === 'dump')
    return nodes()
      .filter(
        (node) =>
          node.text ||
          node['content-desc'] ||
          node.class === 'android.widget.EditText',
      )
      .map((node) => ({
        text: node.password === 'true' ? '[secure]' : node.text,
        desc: node['content-desc'],
        id: node['resource-id'],
        class: node.class,
        bounds: node.bounds,
        enabled: node.enabled,
      }))
  if (value.action === 'click') {
    tap(
      nodes().find((node) =>
        value.id
          ? node['resource-id'] === value.id
          : value.desc
            ? node['content-desc'] === value.desc
            : node.text === value.text,
      ),
    )
    return { clicked: true }
  }
  if (value.action === 'login') {
    const actor = actors[value.actor || 'musician']
    assert.ok(actor)
    for (const [index, field] of [actor.email, actor.password].entries()) {
      const fields = nodes().filter(
        (node) => node.class === 'android.widget.EditText',
      )
      assert.equal(fields.length, 2, 'Expected email/password sign-in form')
      tap(fields[index])
      shell('input', 'keyevent', '123')
      shell('input', 'keyevent', ...Array(160).fill('67'))
      shell('input', 'text', field)
    }
    shell('input', 'keyevent', '4')
    tap(
      nodes().find((node) => ['Iniciar sesión', 'Sign in'].includes(node.text)),
    )
    return { submitted: true, actorId: actor.id }
  }
  if (value.action === 'back') return shell('input', 'keyevent', '4')
  if (value.action === 'home') return shell('input', 'keyevent', '3')
  if (value.action === 'stop') return shell('am', 'force-stop', pkg)
  if (value.action === 'snapshot') return snapshot()
  if (value.action === 'offline' || value.action === 'online') {
    if (value.action === 'offline') {
      assert.ok(reverseOwned, 'Only the owned QA mapping may be removed')
      releaseQaReverse()
      reverseOwned = false
    } else {
      assert.ok(!reverseOwned, 'QA mapping is already online')
      assert.ok(
        !adb('reverse', '--list')
          .split(/\r?\n/)
          .some((line) => line.split(/\s+/)[1] === 'tcp:8443'),
      )
      adb('reverse', 'tcp:8443', `tcp:${manifest.android.localTlsPort}`)
      reverseOwned = true
    }
    return { qaTransportOnline: reverseOwned }
  }
  if (value.action === 'otherWrite') {
    const current = await call(actors.musician, `${path(0)}/worship`)
    assert.equal(current.status, 200)
    const login = await call(null, '/native/auth/login', 'POST', {
      email: actors.musician.email,
      password: actors.musician.password,
    })
    assert.equal(login.status, 200)
    actors.secondDevice = {
      ...actors.musician,
      token: login.data.session.access_token,
    }
    const result = await call(
      actors.secondDevice,
      `${path(0)}/worship`,
      'PUT',
      {
        plan: {
          ...current.data.plan,
          songs: current.data.plan.songs.slice().reverse(),
        },
        revision: current.data.revision,
        serviceRevision: current.data.serviceRevision,
      },
      randomUUID(),
    )
    assert.equal(result.status, 200)
    return { proposalRevision: result.data.revision }
  }
  if (value.action === 'apply') {
    const current = await call(actors.admin, `${path(0)}/worship`)
    assert.equal(current.status, 200)
    const applied = await call(
      actors.admin,
      `${path(0)}/worship/apply`,
      'POST',
      {
        revision: current.data.revision,
        serviceRevision: current.data.serviceRevision,
      },
      randomUUID(),
    )
    assert.equal(applied.status, 200)
    validateServiceRecord(applied.data)
    assert.deepEqual(
      applied.data.service,
      applyWorshipPlan(service(0).service, current.data.plan, 'welcome'),
    )
    assert.equal(
      applied.data.service.items.filter((item) => item.kind !== 'SONG').length,
      2,
    )
    await writeFile(
      resolve(output, 'android-service.json'),
      JSON.stringify(applied.data, null, 2) + '\n',
    )
    return {
      serviceRevision: applied.data.revision,
      musicalItems: current.data.plan.songs.length,
      manualItems: 2,
    }
  }
  if (value.action === 'membership')
    return rpc('save_church_membership', {
      p_church_id: churches[0],
      p_user_id: actors.musician.id,
      p_role: 'member',
      p_status: value.status,
      p_expected_revision: value.revision,
    })
  if (value.action === 'observe') {
    assert.equal(typeof value.name, 'string')
    report.observations.push({ name: value.name, evidence: value.evidence })
    await saveReport()
    return { saved: true }
  }
  if (value.action === 'finish') {
    sql(
      `DELETE FROM private.churches WHERE id IN (${churches.map(literal).join(',')}); DELETE FROM public.songs WHERE id IN (${songIds.map(literal).join(',')}); DELETE FROM public.users WHERE id IN (${users.map(literal).join(',')});`,
    )
    assert.equal(
      sql(
        'SELECT (SELECT count(*) FROM public.users)+(SELECT count(*) FROM private.churches)+(SELECT count(*) FROM private.auth_sessions);',
      ),
      '0',
    )
    report.complete = false
    report.operatorReportedPassed = value.passed === true
    report.reviewRequired =
      'Physical evidence requires independent review; an operator boolean is not certification'
    report.fixturesCleaned = true
    await saveReport()
    return { finished: true, fixturesCleaned: true }
  }
  throw new Error('Unsupported physical gate action')
}
const input = createInterface({ input: process.stdin, terminal: false })
for await (const line of input) {
  try {
    const value = JSON.parse(line)
    const result = await command(value)
    console.log(JSON.stringify({ ok: true, result }))
    if (value.action === 'finish') break
  } catch (error) {
    console.log(
      JSON.stringify({
        ok: false,
        message: redactNativeGateFailure(error.message),
      }),
    )
  }
}
input.close()
if (reverseOwned) {
  releaseQaReverse()
  reverseOwned = false
}
if (!report.fixturesCleaned) {
  sql(
    `DELETE FROM private.churches WHERE id IN (${churches.map(literal).join(',')}); DELETE FROM public.songs WHERE id IN (${songIds.map(literal).join(',')}); DELETE FROM public.users WHERE id IN (${users.map(literal).join(',')});`,
  )
  report.fixturesCleaned = true
  report.interrupted = true
  await saveReport()
}
