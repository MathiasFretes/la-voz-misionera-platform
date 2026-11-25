import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  realpath,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { applyWorshipPlan } from '../suite-api/worship-contract.mjs'
import { validateServiceRecord } from '../suite-api/service-record.mjs'
import { loadNativeGateContext } from './native-gate-context.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { manifest, sql } = await loadNativeGateContext()
const client = manifest.client.root
const api = manifest.apiUrl
const origin = manifest.origin
const database = manifest.database.name
const run = randomUUID()
const output = resolve(root, 'test-results/native-gate', manifest.runId)
await mkdir(output, { recursive: true })
const journalRoot = await mkdtemp(join(tmpdir(), 'lvm-native-journal-'))
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`
const digest = (value) => createHash('sha256').update(value).digest('hex')
const clientCommit = execFileSync('git', ['-C', client, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim()
assert.equal(
  clientCommit,
  manifest.client.commit,
  'Client must match gate provenance',
)
assert.equal(
  execFileSync('git', ['-C', client, 'rev-parse', 'HEAD^{tree}'], {
    encoding: 'utf8',
  }).trim(),
  manifest.client.tree,
)
assert.equal(
  execFileSync('git', ['-C', client, 'status', '--porcelain'], {
    encoding: 'utf8',
  }).trim(),
  '',
  'Client source must match its SHA',
)
const compiled = await build({
  stdin: {
    contents: `export { createDeviceBackend } from ${JSON.stringify(join(client, 'apps/mobile/src/lib/deviceBackend.ts'))}; export { createWorshipExchangeRepository } from ${JSON.stringify(join(client, 'packages/core/src/setlists/worshipExchange.ts'))};`,
    resolveDir: root,
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
})
const { createDeviceBackend, createWorshipExchangeRepository } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
)
const report = {
  run,
  clientCommit,
  apiCommit: manifest.server.commit,
  apiTree: manifest.server.tree,
  apiSourceTree: manifest.server.apiTree,
  apiImageId: manifest.server.imageId,
  disposableProject: manifest.project,
  database,
  transport: 'SSH-only loopback mapper; not Android TLS proof',
  secureStorage: 'injected memory; not Android Keystore proof',
  checks: [],
  physicalAndroidVerified: false,
}
const check = (name) => {
  report.checks.push(name)
  console.log(`PASS: ${name}`)
}
const churches = [randomUUID(), randomUUID()]
const songIds = [randomUUID(), randomUUID()]
const users = []
const devices = []
let currentAccount
let online = true
let loseAck = false
const serviceId = `native-gate-${run}`
const servicePath = `/churches/${churches[0]}/services/${serviceId}`
const input = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
async function device(
  email,
  password,
  signup = false,
  credentials = new Map(),
) {
  const backend = createDeviceBackend({
    apiUrl: `${origin}/api`,
    storage: {
      getItem: async (key) => credentials.get(key) ?? null,
      setItem: async (key, value) => {
        credentials.set(key, value)
      },
      removeItem: async (key) => {
        credentials.delete(key)
      },
    },
    fetcher: async (url, init) => {
      if (!online) throw new Error('Deliberate offline gate')
      const address = new URL(url)
      const result = await fetch(
        `${api}${address.pathname.slice(4)}${address.search}`,
        init,
      )
      return new Response(await result.arrayBuffer(), {
        status: result.status,
        headers: result.headers,
      })
    },
  })
  const result = signup
    ? await backend.client.auth.signUp({ email, password })
    : await backend.client.auth.signInWithPassword({ email, password })
  assert.equal(result.error, null)
  const session = await backend.readStoredSession()
  assert.match(session.access_token, /^n_[A-Za-z0-9_-]{43}$/)
  const actor = {
    ...backend,
    credentials,
    email,
    password,
    id: session.user.id,
    token: session.access_token,
  }
  devices.push(actor)
  if (signup) users.push(actor.id)
  return actor
}
async function account(label) {
  return device(`native-gate-${label}-${run}@example.com`, randomUUID(), true)
}
async function request(actor, path, method = 'GET', body, operation) {
  const result = await actor.fetch(`${origin}/api${path}`, {
    method,
    headers: {
      'X-LVM-Account': actor.id,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(operation ? { 'X-LVM-Operation': operation } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: result.status, data: await result.json() }
}
async function rpc(actor, name, body) {
  const result = await request(actor, `/data/rpc/${name}`, 'POST', body)
  assert.equal(result.status, 200, name)
  return result.data
}
function journal(deviceId) {
  const directory = join(journalRoot, deviceId)
  return {
    getItem: async (key) =>
      readFile(join(directory, digest(key)), 'utf8').catch((error) => {
        if (error.code === 'ENOENT') return null
        throw error
      }),
    setItem: async (key, value) => {
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, digest(key)), value)
    },
  }
}
function repository(actor, storage, branchId, church = churches[0]) {
  return createWorshipExchangeRepository({
    scope: { userId: actor.id, churchId: church, serviceId, branchId },
    storage,
    uuid: randomUUID,
    isActive: () => currentAccount === actor.id,
    request: async (path, init) => {
      const result = await actor.fetch(`${origin}${path}`, init)
      if (loseAck && init.method === 'PUT' && result.ok) {
        loseAck = false
        await result.arrayBuffer()
        throw new Error('Acknowledgement lost after actual commit')
      }
      return result
    },
  })
}
const planRow = () =>
  JSON.parse(
    sql(
      `SELECT jsonb_build_object('revision',revision,'plan',plan) FROM private.worship_plans WHERE church_id=${literal(churches[0])} AND service_id=${literal(serviceId)};`,
    ),
  )
try {
  assert.equal(sql('SELECT current_database();'), database)
  assert.equal(
    sql(
      'SELECT (SELECT count(*) FROM public.users)+(SELECT count(*) FROM private.churches);',
    ),
    '0',
    'Gate requires an empty isolated database',
  )
  const admin = await account('admin')
  const musician = await account('musician')
  const outsider = await account('outsider')
  sql(`UPDATE public.users SET role='admin' WHERE id=${literal(admin.id)};`)
  for (const church of churches)
    await rpc(admin, 'save_church', {
      p_id: church,
      p_name: `Native QA ${church}`,
      p_status: 'active',
      p_expected_revision: 0,
    })
  await rpc(admin, 'save_church_membership', {
    p_church_id: churches[0],
    p_user_id: musician.id,
    p_role: 'member',
    p_status: 'active',
    p_expected_revision: 0,
  })
  await rpc(admin, 'save_church_membership', {
    p_church_id: churches[1],
    p_user_id: outsider.id,
    p_role: 'member',
    p_status: 'active',
    p_expected_revision: 0,
  })
  const manual = [
    {
      id: 'welcome',
      kind: 'ANNOUNCEMENT',
      announcement: { title: 'Bienvenida QA', body: 'Comunidad' },
    },
    {
      id: 'message',
      kind: 'SERMON',
      sermon: { title: 'Mensaje QA', body: 'Esperanza' },
    },
  ]
  const original = {
    id: serviceId,
    venue: 'QA',
    worshipAfterItemId: 'welcome',
    service: {
      schemaVersion: '0.1',
      id: serviceId,
      title: 'Culto nativo QA',
      startsAt: '2026-12-01T12:00:00Z',
      setlist: { id: `set-${serviceId}`, name: 'Ensayo QA' },
      items: manual,
    },
  }
  assert.equal(
    (await request(admin, servicePath, 'PUT', original, randomUUID())).status,
    200,
  )
  const songValues = [
    ['Alba QA', 'D', '{key:D}\n[D]Sale el sol 😀 [A]hoy'],
    ['Fidelidad QA', 'C', '{key:C}\n[C]Tu [G]fidelidad'],
  ]
  for (let index = 0; index < songIds.length; index++)
    sql(
      `INSERT INTO public.songs(id,slug,title,default_key,chordpro_content,created_by) VALUES(${literal(songIds[index])},${literal(`native-gate-${index}-${run}`)},${songValues[index].map(literal).join(',')},${literal(admin.id)});`,
    )
  const login = await fetch(`${api}/auth/login`, {
    ...input({ email: admin.email, password: admin.password }),
    headers: { Origin: origin, 'Content-Type': 'application/json' },
  })
  assert.equal(login.status, 200)
  const cookie = login.headers.get('set-cookie').split(';')[0]
  assert.equal((await login.json()).session.access_token, undefined)
  const secondDevice = await device(musician.email, musician.password)
  assert.notEqual(secondDevice.token, musician.token)
  assert.equal(
    (await musician.client.auth.getSession()).data.session.user.id,
    musician.id,
  )
  assert.equal(
    sql(
      `SELECT count(*) FROM private.auth_sessions WHERE token_hash=${literal(digest(musician.token))} AND expires_at>now();`,
    ),
    '1',
  )
  check(
    'actual native login, independent device tokens, database-backed session and shared web identity',
  )
  const catalog = await request(
    musician,
    '/data/songs?select=id,title,default_key,chordpro_content&order=title',
  )
  assert.equal(catalog.status, 200)
  assert.equal(catalog.data.length, 2)
  const entries = catalog.data.map((song) => ({
    id: randomUUID(),
    song: {
      id: song.id,
      title: song.title,
      originalKey: song.default_key,
      chordpro_content: song.chordpro_content,
    },
    toKey: null,
  }))
  currentAccount = musician.id
  const storageA = journal('device-a')
  const branchA = randomUUID()
  let repoA = repository(musician, storageA, branchA)
  await repoA.refresh()
  await repoA.edit((draft) => ({ ...draft, entries }))
  await repoA.edit((draft) => ({
    ...draft,
    entries: draft.entries.slice().reverse(),
  }))
  await repoA.edit((draft) => ({
    ...draft,
    entries: [
      ...draft.entries,
      { ...draft.entries[0], id: randomUUID(), toKey: 'G' },
    ],
  }))
  await repoA.edit((draft) => ({
    ...draft,
    entries: draft.entries.map((entry, index) =>
      index === 0 ? { ...entry, toKey: 'E' } : entry,
    ),
  }))
  const queued = await repoA.queue()
  assert.equal(queued.pending.input.plan.songs.length, 3)
  online = false
  assert.equal(
    (await musician.client.auth.getSession()).data.session.user.id,
    musician.id,
  )
  await assert.rejects(repoA.flush(), /offline/)
  repoA.dispose()
  repoA = repository(musician, storageA, branchA)
  assert.deepEqual((await repoA.read()).pending, queued.pending)
  assert.equal(
    sql(
      `SELECT count(*) FROM private.worship_plans WHERE church_id=${literal(churches[0])};`,
    ),
    '0',
  )
  check(
    'catalog snapshots, order, repeated occurrences, tones and durable offline restart without server writes',
  )
  online = true
  loseAck = true
  await assert.rejects(repoA.flush(), /Acknowledgement lost/)
  assert.equal(planRow().revision, 1)
  const committedId = queued.pending.id
  assert.equal((await repoA.read()).pending.id, committedId)
  assert.equal((await repoA.flush()).pending, null)
  assert.equal(
    sql(
      `SELECT count(*) FROM private.worship_plan_history WHERE church_id=${literal(churches[0])};`,
    ),
    '1',
  )
  assert.equal(
    sql(
      `SELECT count(*) FROM private.service_plan_operations WHERE church_id=${literal(churches[0])} AND operation_id=${literal(committedId)};`,
    ),
    '1',
  )
  check(
    'lost HTTP acknowledgement after a real commit replays the same UUID without a second proposal/history row',
  )
  const repoB = repository(secondDevice, journal('device-b'), randomUUID())
  await repoB.refresh()
  await repoA.edit((draft) => ({
    ...draft,
    entries: draft.entries.map((entry, index) =>
      index === 1 ? { ...entry, toKey: 'F' } : entry,
    ),
  }))
  const conflicting = await repoA.queue()
  await repoB.edit((draft) => ({
    ...draft,
    entries: draft.entries.map((entry, index) =>
      index === 0 ? { ...entry, toKey: 'A' } : entry,
    ),
  }))
  await repoB.queue()
  await repoB.flush()
  const otherPlan = planRow()
  assert.equal(otherPlan.revision, 2)
  await assert.rejects(repoA.flush(), { status: 409 })
  const held = await repoA.read()
  assert.equal(held.conflict.status, 409)
  assert.equal(held.pending.id, conflicting.pending.id)
  assert.deepEqual(held.draft, conflicting.draft)
  assert.deepEqual(planRow(), otherPlan)
  await repoA.cancelPending()
  await repoA.refresh()
  const resolved = await repoA.queue()
  assert.notEqual(resolved.pending.id, conflicting.pending.id)
  assert.equal(resolved.pending.input.revision, 2)
  await repoA.flush()
  assert.equal(planRow().revision, 3)
  check(
    'two independent native sessions produce a real 409; explicit cancellation/refresh/resubmission retains local music',
  )
  const applied = await fetch(`${api}${servicePath}/worship/apply`, {
    ...input({ revision: 3, serviceRevision: 1 }),
    headers: {
      Origin: origin,
      Cookie: cookie,
      'X-LVM-Account': admin.id,
      'X-LVM-Operation': randomUUID(),
      'Content-Type': 'application/json',
    },
  })
  assert.equal(applied.status, 200)
  const merged = await applied.json()
  validateServiceRecord(merged)
  assert.deepEqual(
    merged.service,
    applyWorshipPlan(original.service, resolved.pending.input.plan, 'welcome'),
  )
  assert.deepEqual(
    merged.service.items.filter((item) => item.kind !== 'SONG'),
    manual,
  )
  assert.equal(new Set(merged.service.items.map((item) => item.id)).size, 5)
  assert.deepEqual(
    JSON.parse(
      sql(
        `SELECT record||jsonb_build_object('revision',revision) FROM private.service_plans WHERE church_id=${literal(churches[0])} AND id=${literal(serviceId)};`,
      ),
    ),
    merged,
  )
  await writeFile(
    join(output, 'native-resolved-service.json'),
    JSON.stringify(merged, null, 2) + '\n',
  )
  report.finalServiceSha256 = digest(
    await readFile(join(output, 'native-resolved-service.json')),
  )
  report.postgres = {
    proposalRevision: 3,
    serviceRevision: merged.revision,
    musicalOccurrences: 3,
    manualItems: 2,
    worshipHistoryRows: Number(
      sql(
        `SELECT count(*) FROM private.worship_plan_history WHERE church_id=${literal(churches[0])};`,
      ),
    ),
  }
  check(
    'Service applies the actual native proposal; SQL equals canonical merge, valid Service 0.1, manual elements and unique IDs preserved',
  )
  currentAccount = outsider.id
  const otherScope = repository(outsider, storageA, branchA, churches[1])
  assert.equal((await otherScope.read()).draft, null)
  await assert.rejects(repoA.read(), { status: 409 })
  assert.equal((await request(outsider, `${servicePath}/worship`)).status, 403)
  currentAccount = musician.id
  const wrongActor = await musician.fetch(
    `${origin}/api${servicePath}/worship`,
    { headers: { 'X-LVM-Account': outsider.id } },
  )
  assert.equal(wrongActor.status, 403)
  check(
    'account/church journal isolation and authenticated X-LVM-Account mismatch rejection',
  )
  await rpc(admin, 'save_church_membership', {
    p_church_id: churches[0],
    p_user_id: musician.id,
    p_role: 'member',
    p_status: 'suspended',
    p_expected_revision: 1,
  })
  assert.equal(
    (
      await request(
        musician,
        `${servicePath}/worship`,
        'PUT',
        queued.pending.input,
        committedId,
      )
    ).status,
    403,
  )
  assert.equal((await repoA.read()).draft.entries.length, 3)
  await rpc(admin, 'save_church_membership', {
    p_church_id: churches[0],
    p_user_id: musician.id,
    p_role: 'member',
    p_status: 'active',
    p_expected_revision: 2,
  })
  const rawWrite = (authorization, extra = {}) =>
    fetch(`${api}${servicePath}/worship`, {
      method: 'PUT',
      headers: {
        'X-LVM-Client': 'native',
        'X-LVM-Account': musician.id,
        'X-LVM-Operation': randomUUID(),
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
        ...extra,
      },
      body: JSON.stringify({
        ...resolved.pending.input,
        revision: 3,
        serviceRevision: 2,
      }),
    })
  assert.equal((await rawWrite(null)).status, 403)
  assert.equal((await rawWrite(`n_${'x'.repeat(43)}`)).status, 403)
  sql(
    `UPDATE private.auth_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=${literal(digest(musician.token))};`,
  )
  assert.equal((await rawWrite(musician.token)).status, 403)
  sql(
    `DELETE FROM private.auth_sessions WHERE token_hash=${literal(digest(secondDevice.token))};`,
  )
  assert.equal((await rawWrite(secondDevice.token)).status, 403)
  assert.equal(planRow().revision, 3)
  check(
    'membership suspension blocks idempotent replay; header alone, fabricated, expired and revoked tokens cannot write',
  )
  for (const directory of await readdir(journalRoot))
    for (const file of await readdir(join(journalRoot, directory))) {
      const value = await readFile(join(journalRoot, directory, file), 'utf8')
      assert.ok(
        !/n_[A-Za-z0-9_-]{43}|access_token|refresh_token|authorization|password/i.test(
          value,
        ),
        'Musical journal must not contain authentication data',
      )
      for (const actor of devices) {
        assert.ok(!value.includes(actor.token))
        assert.ok(!value.includes(actor.password))
      }
    }
  check(
    'durable musical journal contains no device tokens, passwords or authentication session fields',
  )
} finally {
  online = true
  for (const actor of devices) actor.client.auth.stopAutoRefresh()
  sql(
    `DELETE FROM private.churches WHERE id IN (${churches.map(literal).join(',')}); DELETE FROM public.songs WHERE id IN (${songIds.map(literal).join(',')});`,
  )
  if (users.length)
    sql(
      `DELETE FROM public.users WHERE id IN (${users.map(literal).join(',')});`,
    )
  const remaining = JSON.parse(
    sql(
      `SELECT jsonb_build_object('users',(SELECT count(*) FROM public.users),'churches',(SELECT count(*) FROM private.churches),'songs',(SELECT count(*) FROM public.songs),'sessions',(SELECT count(*) FROM private.auth_sessions),'plans',(SELECT count(*) FROM private.service_plans));`,
    ),
  )
  assert.deepEqual(remaining, {
    users: 0,
    churches: 0,
    songs: 0,
    sessions: 0,
    plans: 0,
  })
  report.cleanup = remaining
  const location = await realpath(journalRoot)
  assert.equal(dirname(location), await realpath(tmpdir()))
  assert.ok(basename(location).startsWith('lvm-native-journal-'))
  await rm(location, { recursive: true })
  report.integrationPassed = report.checks.length === 8
  await writeFile(
    join(output, `native-api-report-${run}.json`),
    JSON.stringify(report, null, 2) + '\n',
  )
  await writeFile(
    join(output, 'native-api-report.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
}
assert.equal(report.integrationPassed, true)
console.log(
  'PASS: native client journal ↔ isolated PostgreSQL/API; all owned fixtures cleaned; physical Android gate remains separate',
)
