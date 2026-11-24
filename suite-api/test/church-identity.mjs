import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const origin = process.env.LVM_ORIGIN
const base = process.env.LVM_TEST_URL || 'http://api:4318'
const pool = new pg.Pool({
  host: 'postgres',
  database: 'lvm_worship',
  user: 'lvm_owner',
  password: (await readFile('/run/secrets/postgres_password', 'utf8')).trim(),
})
const users = []
const churches = [randomUUID(), randomUUID()]
const run = randomUUID()
async function request(
  path,
  cookie,
  data,
  method = data === undefined ? 'GET' : 'POST',
) {
  const response = await fetch(`${base}/api/${path}`, {
    method,
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
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
async function createUser(label) {
  const result = await request('auth/signup', null, {
    email: `identity-qa-${label}-${run}@example.com`,
    password: randomUUID(),
    options: { data: { full_name: `Identity QA ${label}` } },
  })
  assert.equal(result.status, 201, JSON.stringify(result.data))
  users.push(result.data.user.id)
  return { id: result.data.user.id, cookie: result.cookie }
}
function rpc(name, actor, data = {}) {
  return request(`data/rpc/${name}`, actor?.cookie, data)
}
function ok(result) {
  assert.equal(result.status, 200, JSON.stringify(result.data))
  return result.data
}
function denied(result) {
  assert.ok([401, 403].includes(result.status), JSON.stringify(result))
}
function membership(church, user, role, status = 'active', revision = 0) {
  return {
    p_church_id: church,
    p_user_id: user.id,
    p_role: role,
    p_status: status,
    p_expected_revision: revision,
  }
}
try {
  const global = await createUser('global')
  const coordinator = await createUser('coordinator')
  const member = await createUser('member')
  const outsider = await createUser('outsider')
  await pool.query("UPDATE public.users SET role='admin' WHERE id=$1", [
    global.id,
  ])
  denied(await rpc('list_churches', null))
  denied(await rpc('list_suite_accounts', null))
  denied(await rpc('list_suite_accounts', coordinator))
  assert.equal(
    ok(await rpc('list_suite_accounts', global)).find(
      (row) => row.id === member.id,
    ).email,
    `identity-qa-member-${run}@example.com`,
  )
  assert.deepEqual(ok(await rpc('list_churches', outsider)), [])
  denied(
    await rpc('save_church', member, {
      p_id: churches[0],
      p_name: 'Forbidden',
      p_status: 'active',
      p_expected_revision: 0,
    }),
  )
  for (const [index, id] of churches.entries()) {
    ok(
      await rpc('save_church', global, {
        p_id: id,
        p_name: `Identity QA ${run} ${index}`,
        p_status: 'active',
        p_expected_revision: 0,
      }),
    )
  }
  const save = (actor, input) => rpc('save_church_membership', actor, input)
  ok(await save(global, membership(churches[0], coordinator, 'admin')))
  ok(await save(global, membership(churches[1], outsider, 'admin')))
  denied(await rpc('list_suite_accounts', coordinator))
  denied(await rpc('list_site_inbox', coordinator))
  denied(
    await rpc('list_site_documents', coordinator, { p_collection: 'eventos' }),
  )
  assert.deepEqual(
    ok(await rpc('list_churches', coordinator)).map((c) => c.id),
    [churches[0]],
  )
  denied(
    await rpc('list_church_memberships', coordinator, {
      p_church_id: churches[1],
    }),
  )
  denied(await save(coordinator, membership(churches[1], member, 'member')))
  denied(await save(coordinator, membership(churches[0], member, 'admin')))
  denied(
    await save(
      coordinator,
      membership(churches[0], coordinator, 'member', 'active', 1),
    ),
  )
  ok(await save(coordinator, membership(churches[0], member, 'member')))
  const own = ok(await rpc('my_church_memberships', member))
  assert.equal(own.length, 1)
  assert.equal(own[0].church_id, churches[0])
  assert.ok(own[0].capabilities.includes('worship:prepare'))
  assert.ok(!own[0].capabilities.includes('members:manage'))
  denied(
    await rpc('list_church_memberships', member, { p_church_id: churches[0] }),
  )
  denied(
    await save(member, membership(churches[0], member, 'admin', 'active', 1)),
  )
  denied(
    await rpc('update_user_role', coordinator, {
      target_user_id: member.id,
      new_role: 'admin',
    }),
  )
  assert.equal(
    (await request(`data/users?id=eq.${outsider.id}`, coordinator.cookie)).data
      .length,
    0,
  )
  assert.equal(
    (await request('auth/session', coordinator.cookie)).data.session.user.role,
    'user',
  )
  assert.equal(
    (await request('auth/session', coordinator.cookie)).data.session.user
      .memberships[0].role,
    'admin',
  )
  // Parallel updates must produce one success and one conflict, never a silent overwrite.
  const writes = await Promise.all([
    save(coordinator, membership(churches[0], member, 'leader', 'active', 1)),
    save(coordinator, membership(churches[0], member, 'viewer', 'active', 1)),
  ])
  assert.deepEqual(writes.map((r) => r.status).sort(), [200, 409])
  assert.equal(ok(await rpc('my_church_memberships', member))[0].revision, 2)
  ok(await save(global, membership(churches[0], member, 'leader', 'active', 2)))
  ok(await rpc('list_church_memberships', member, { p_church_id: churches[0] }))
  denied(await save(member, membership(churches[0], outsider, 'member')))
  ok(
    await save(
      coordinator,
      membership(churches[0], member, 'leader', 'suspended', 3),
    ),
  )
  assert.deepEqual(ok(await rpc('list_churches', member)), [])
  assert.deepEqual(
    ok(await rpc('my_church_memberships', member))[0].capabilities,
    [],
  )
  denied(
    await rpc('list_church_memberships', member, { p_church_id: churches[0] }),
  )
  // Existing session loses effective capabilities immediately when its church is suspended.
  ok(
    await rpc('save_church', global, {
      p_id: churches[0],
      p_name: `Identity QA ${run}`,
      p_status: 'suspended',
      p_expected_revision: 1,
    }),
  )
  assert.deepEqual(
    (await request('auth/session', coordinator.cookie)).data.session.user
      .memberships[0].capabilities,
    [],
  )
  denied(await save(coordinator, membership(churches[0], outsider, 'member')))
  ok(
    await rpc('save_church', global, {
      p_id: churches[0],
      p_name: `Identity QA ${run}`,
      p_status: 'active',
      p_expected_revision: 2,
    }),
  )
  // Last administrator protection is enforced in PostgreSQL even for global administration.
  assert.equal(
    (
      await save(
        global,
        membership(churches[0], coordinator, 'member', 'active', 1),
      )
    ).status,
    400,
  )
  ok(await save(global, membership(churches[0], global, 'admin')))
  ok(
    await save(
      global,
      membership(churches[0], coordinator, 'admin', 'suspended', 1),
    ),
  )
  denied(await save(coordinator, membership(churches[0], outsider, 'member')))
  assert.deepEqual(ok(await rpc('list_churches', coordinator)), [])
  assert.equal(
    (await request('data/rpc/save_church', global.cookie, undefined)).status,
    405,
  )
  assert.equal(
    (await request('data/church_memberships', global.cookie)).status,
    404,
  )
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM private.identity_audit WHERE church_id=ANY($1::uuid[])',
        [churches],
      )
    ).rows[0].n,
    12,
  )
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET LOCAL ROLE lvm_user')
    await assert.rejects(
      client.query('SELECT * FROM private.church_memberships'),
      { code: '42501' },
    )
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
  console.log(
    'PASS: church isolation, scoped capabilities, no global escalation, role/member/church revocation on existing sessions, last administrator, concurrent revisions, private tables and audit history',
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
