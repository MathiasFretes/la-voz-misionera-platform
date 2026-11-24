import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { applyWorshipPlan } from '../suite-api/worship-contract.mjs'
import { validateServiceRecord } from '../suite-api/service-record.mjs'
import { passwordHash } from '../suite-api/security.mjs'

// Fixture credentials stay in this process. The interactive protocol exposes
// only test IDs, scoped UI metadata and assertions, never passwords/tokens.
const api = 'http://127.0.0.1:54319/api'
const database = 'lvm_planning_qa_20261121'
const pkg = 'com.lavozmisionera.qa'
const resumeRun = process.argv[2]
assert.ok(
  !resumeRun || /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(resumeRun),
  'Optional argument must be a QA run UUID',
)
const run = resumeRun || randomUUID()
const output = resolve('test-results/native-gate/android')
await mkdir(output, { recursive: true })
const users = []
const churches = [randomUUID(), randomUUID()]
const songIds = [randomUUID(), randomUUID()]
const actors = {}
const report = {
  run,
  clientCommit: '5cd6845fb77e8e8643fe4c0a02705c8143fb27b3',
  apiCommit: '1949aac195a78c62ee7df017b45dec9f45ac959f',
  database,
  applicationId: pkg,
  observations: [],
  complete: false,
}
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`
const sql = (statement) =>
  execFileSync(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      'hostinger-vps',
      `cd /srv/apps/la-voz-misionera && docker compose exec -T postgres psql -U lvm_owner -d ${database} -v ON_ERROR_STOP=1 -At`,
    ],
    { input: statement, encoding: 'utf8' },
  ).trim()
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`
function adb(...args) {
  try {
    return execFileSync('adb', args, {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    })
  } catch {
    throw new Error('ADB operation failed; no command arguments logged')
  }
}
const shell = (...args) => adb('shell', args.map(quote).join(' '))
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
if (!resumeRun)
  assert.equal(
    sql('SELECT count(*) FROM public.users;'),
    '0',
    'Physical gate requires cleaned isolated fixtures',
  )
if (resumeRun) {
  // Recover only this fully isolated fixture run, never institutional accounts.
  const fixture = JSON.parse(
    sql(
      `SELECT jsonb_build_object('users',(SELECT jsonb_agg(jsonb_build_object('id',u.id,'email',c.email)) FROM public.users u LEFT JOIN private.credentials c ON c.user_id=u.id),'churches',(SELECT jsonb_agg(jsonb_build_object('id',id,'name',name)) FROM private.churches),'songs',(SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug)) FROM public.songs));`,
    ),
  )
  assert.equal(fixture.users?.length, 3)
  assert.equal(fixture.churches?.length, 2)
  assert.equal(fixture.songs?.length, 2)
  for (const label of ['admin', 'musician', 'other']) {
    const actor = fixture.users.find(
      (user) => user.email === `native-android-${label}-${run}@example.com`,
    )
    assert.ok(actor, 'Resume requires exactly the owned QA accounts')
  }
  for (const [index, name] of [
    'Iglesia Android QA',
    'Otra iglesia Android QA',
  ].entries()) {
    const church = fixture.churches.find((value) => value.name === name)
    const song = fixture.songs.find(
      (value) => value.slug === `native-android-${index}-${run}`,
    )
    assert.ok(church && song, 'Resume fixture identity mismatch')
    churches[index] = church.id
    songIds[index] = song.id
    assert.equal(
      sql(
        `SELECT count(*) FROM private.service_plans WHERE church_id=${literal(church.id)} AND id=${literal(service(index).id)};`,
      ),
      '1',
    )
  }
  for (const label of ['admin', 'musician', 'other']) {
    const actor = fixture.users.find(
      (user) => user.email === `native-android-${label}-${run}@example.com`,
    )
    actor.password = randomUUID()
    const hash = await passwordHash(actor.password)
    assert.equal(
      sql(
        `WITH changed AS (UPDATE private.credentials SET password_hash=${literal(hash)} WHERE user_id=${literal(actor.id)} AND email=${literal(actor.email)} RETURNING user_id) SELECT count(*) FROM changed;`,
      ),
      '1',
    )
    const login = await call(null, '/native/auth/login', 'POST', {
      email: actor.email,
      password: actor.password,
    })
    assert.equal(login.status, 200)
    actor.token = login.data.session.access_token
    users.push(actor.id)
    actors[label] = actor
  }
  report.resumed = true
  report.fixtureCredentialRecovery =
    'QA-only password reset; existing device sessions preserved; not password-revocation evidence'
}
await saveReport()
try {
  if (!resumeRun) {
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
    const verb = value.action === 'offline' ? 'stop' : 'start'
    return execFileSync(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        'hostinger-vps',
        `test "$(docker inspect -f '{{index .Config.Labels "lvm.qa.run"}}' lvm-native-qa-tls)" = native-gate-20261122 && docker ${verb} lvm-native-qa-tls`,
      ],
      { encoding: 'utf8' },
    ).trim()
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
    report.complete = value.passed === true
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
    console.log(JSON.stringify({ ok: false, message: error.message }))
  }
}
input.close()
if (!report.fixturesCleaned) {
  sql(
    `DELETE FROM private.churches WHERE id IN (${churches.map(literal).join(',')}); DELETE FROM public.songs WHERE id IN (${songIds.map(literal).join(',')}); DELETE FROM public.users WHERE id IN (${users.map(literal).join(',')});`,
  )
  report.fixturesCleaned = true
  report.interrupted = true
  await saveReport()
}
