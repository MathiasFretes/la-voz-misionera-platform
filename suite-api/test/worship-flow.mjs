import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { applyWorshipPlan } from '../worship-contract.mjs'
import { validateServiceRecord } from '../service-record.mjs'

const database = process.env.LVM_DATABASE
if (database !== 'lvm_planning_qa_20261121')
  throw new Error(
    'This verifier only runs against the isolated planning QA database',
  )
const base = 'http://lvm-planning-qa-api:4318'
const origin = 'https://srv2137598.hstgr.cloud'
const pool = new pg.Pool({
  host: 'postgres',
  database,
  user: 'lvm_owner',
  password: (await readFile('/run/secrets/postgres_password', 'utf8')).trim(),
})
const users = []
const churches = [randomUUID(), randomUUID()]
const serviceId = `worship-qa-${randomUUID()}`
async function request(
  path,
  actor,
  input,
  method = input === undefined ? 'GET' : 'POST',
  operation,
) {
  const response = await fetch(`${base}/api/${path}`, {
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
    data: text ? JSON.parse(text) : null,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  }
}
const ok = (response) => {
  assert.equal(response.status, 200, JSON.stringify(response.data))
  return response.data
}
async function user(label) {
  const response = await request('auth/signup', null, {
    email: `worship-qa-${label}-${randomUUID()}@example.com`,
    password: randomUUID(),
  })
  assert.equal(response.status, 201)
  const account = { id: response.data.user.id, cookie: response.cookie }
  users.push(account.id)
  return account
}
const rpc = async (name, actor, input) =>
  ok(await request(`data/rpc/${name}`, actor, input))
try {
  const admin = await user('admin')
  const musician = await user('musician')
  const viewer = await user('viewer')
  const outsider = await user('outsider')
  await pool.query("UPDATE public.users SET role='admin' WHERE id=$1", [
    admin.id,
  ])
  for (const church of churches)
    await rpc('save_church', admin, {
      p_id: church,
      p_name: `Worship QA ${church}`,
      p_status: 'active',
      p_expected_revision: 0,
    })
  for (const [actor, church, role] of [
    [musician, churches[0], 'member'],
    [viewer, churches[0], 'viewer'],
    [outsider, churches[1], 'member'],
  ]) {
    await rpc('save_church_membership', admin, {
      p_church_id: church,
      p_user_id: actor.id,
      p_role: role,
      p_status: 'active',
      p_expected_revision: 0,
    })
  }
  const path = `churches/${churches[0]}/services/${serviceId}`
  const manual = [
    {
      id: 'welcome',
      kind: 'ANNOUNCEMENT',
      announcement: { title: 'Bienvenida', body: 'Comunidad' },
    },
    {
      id: 'message',
      kind: 'SERMON',
      sermon: { title: 'Mensaje', body: 'Esperanza' },
    },
  ]
  const original = {
    id: serviceId,
    venue: 'Central',
    worshipAfterItemId: 'welcome',
    service: {
      schemaVersion: '0.1',
      id: serviceId,
      title: 'Culto QA',
      startsAt: '2026-12-01T12:00:00Z',
      setlist: { id: `set-${serviceId}`, name: 'Música' },
      items: manual,
    },
  }
  ok(await request(path, admin, original, 'PUT', randomUUID()))
  assert.equal((await request(`${path}/worship`, null)).status, 401)
  assert.equal((await request(`${path}/worship`, outsider)).status, 403)
  const context = ok(await request(`${path}/worship`, musician))
  assert.equal(context.context.serviceId, serviceId)
  assert.equal(context.canPrepare, true)
  assert.equal(context.canApply, false)
  assert.equal(context.record, undefined)
  const song = {
    songId: 'qa-song',
    title: 'Fiel',
    key: 'G',
    arrangement: [1],
    sections: [
      {
        kind: 'verse',
        label: 'Verso',
        lines: [{ text: 'Fiel', chords: [{ symbol: 'G', index: 0 }] }],
      },
    ],
  }
  const plan = {
    schemaVersion: '0.1',
    serviceId,
    setlistId: context.context.setlistId,
    name: context.context.name,
    songs: [song, song],
  }
  const input = { plan, revision: 0, serviceRevision: 1 }
  assert.equal(
    (await request(`${path}/worship`, viewer, input, 'PUT', randomUUID()))
      .status,
    403,
  )
  assert.equal(
    (
      await request(
        `${path}/worship`,
        musician,
        { ...input, plan: { ...plan, sermon: {} } },
        'PUT',
        randomUUID(),
      )
    ).status,
    400,
  )
  assert.equal(
    (
      await request(
        `${path}/worship`,
        musician,
        {
          ...input,
          plan: { ...plan, songs: [{ ...song, arrangement: [1, 1] }] },
        },
        'PUT',
        randomUUID(),
      )
    ).status,
    400,
  )
  const submission = randomUUID()
  const proposed = ok(
    await request(`${path}/worship`, musician, input, 'PUT', submission),
  )
  assert.equal(proposed.revision, 1)
  assert.deepEqual(
    ok(await request(`${path}/worship`, musician, input, 'PUT', submission)),
    proposed,
  )
  assert.equal(
    (await request(`${path}/worship`, musician, input, 'PUT', randomUUID()))
      .status,
    409,
  )
  assert.equal(
    (
      await request(
        `${path}/worship/apply`,
        musician,
        { revision: 1, serviceRevision: 1 },
        'POST',
        randomUUID(),
      )
    ).status,
    403,
  )
  const apply = randomUUID()
  const merged = ok(
    await request(
      `${path}/worship/apply`,
      admin,
      { revision: 1, serviceRevision: 1 },
      'POST',
      apply,
    ),
  )
  validateServiceRecord(merged)
  assert.deepEqual(
    merged.service,
    applyWorshipPlan(original.service, plan, original.worshipAfterItemId),
  )
  assert.equal(merged.revision, 2)
  assert.deepEqual(
    ok(
      await request(
        `${path}/worship/apply`,
        admin,
        { revision: 1, serviceRevision: 1 },
        'POST',
        apply,
      ),
    ),
    merged,
  )
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM private.service_plan_history WHERE church_id=$1 AND service_id=$2',
        [churches[0], serviceId],
      )
    ).rows[0].n,
    2,
  )
  const current = ok(await request(`${path}/worship`, musician))
  assert.equal(current.appliedPlanRevision, 1)
  assert.equal(current.appliedServiceRevision, 2)
  assert.equal(
    (
      await request(
        `${path}/worship`,
        musician,
        { ...input, revision: 1 },
        'PUT',
        randomUUID(),
      )
    ).status,
    409,
  )
  // Two tabs submitting the same expected musical revision get one success and one conflict.
  const concurrent = await Promise.all([
    request(
      `${path}/worship`,
      musician,
      { ...input, revision: 1, serviceRevision: 2 },
      'PUT',
      randomUUID(),
    ),
    request(
      `${path}/worship`,
      musician,
      { ...input, revision: 1, serviceRevision: 2 },
      'PUT',
      randomUUID(),
    ),
  ])
  assert.deepEqual(
    concurrent.map((response) => response.status).sort(),
    [200, 409],
  )
  await rpc('save_church_membership', admin, {
    p_church_id: churches[0],
    p_user_id: musician.id,
    p_role: 'member',
    p_status: 'suspended',
    p_expected_revision: 1,
  })
  assert.equal(
    (await request(`${path}/worship`, musician, input, 'PUT', submission))
      .status,
    403,
  )
  assert.equal(
    (await request('data/rpc/save_worship_plan', admin, {})).status,
    404,
    'Raw RPC must not bypass the parser',
  )
  console.log(
    'PASS: real shared sessions, tenant isolation, context-only response, music contract validation, viewer/musician/planner boundaries, concurrent musical revisions, idempotent submission/application, SQL merge equals canonical Service merge, valid Service 0.1 and revocation before replay',
  )
} finally {
  await pool.query('DELETE FROM private.churches WHERE id=ANY($1::uuid[])', [
    churches,
  ])
  if (users.length)
    await pool.query('DELETE FROM public.users WHERE id=ANY($1::uuid[])', [
      users,
    ])
  await pool.end()
}
