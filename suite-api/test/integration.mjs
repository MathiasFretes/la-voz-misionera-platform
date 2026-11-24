import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { newToken, tokenHash } from '../security.mjs'

const base = process.env.LVM_TEST_URL || 'http://api:4318'
const origin = process.env.LVM_ORIGIN
assert.equal(
  origin,
  'https://lvm-qa.invalid',
  'Run the official test with sh suite-api/test/run-isolated.sh',
)
assert.ok(
  [
    'http://api-off:4318',
    'http://api-disabled:4318',
    'http://api-on:4318',
  ].includes(base),
  'Only disposable integration APIs are allowed',
)
const admin = new pg.Pool({
  host: 'postgres',
  database: 'lvm_worship',
  user: 'lvm_owner',
  password: (await readFile('/run/secrets/postgres_password', 'utf8')).trim(),
})
const created = []
const songs = []
const runId = randomUUID()
const siteId = `qa-${runId}`
const password = `test-${randomUUID()}`
async function request(
  path,
  { method = 'GET', data, cookie, originOverride = origin } = {},
) {
  const response = await fetch(`${base}/api/${path}`, {
    method,
    headers: {
      ...(method !== 'GET'
        ? { 'Content-Type': 'application/json', Origin: originOverride }
        : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      Prefer: 'return=representation',
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
try {
  assert.equal((await request('health')).status, 200)
  const a = await request('auth/signup', {
    method: 'POST',
    data: { email: `a-${runId}@example.com`, password },
  })
  assert.equal(a.status, 201, JSON.stringify(a.data))
  created.push(a.data.user.id)
  const b = await request('auth/signup', {
    method: 'POST',
    data: { email: `b-${runId}@example.com`, password },
  })
  assert.equal(b.status, 201, JSON.stringify(b.data))
  created.push(b.data.user.id)
  assert.equal(
    (
      await request('auth/login', {
        method: 'POST',
        data: { email: a.data.user.email, password: 'incorrect' },
      })
    ).status,
    401,
  )
  assert.equal(
    (await request('auth/session', { cookie: a.cookie })).data.session.user.id,
    a.data.user.id,
  )
  assert.equal(
    (
      await request('auth/logout', {
        method: 'POST',
        cookie: a.cookie,
        data: {},
        originOverride: 'https://evil.example',
      })
    ).status,
    403,
  )
  assert.ok(
    (
      await request(`data/users?id=eq.${b.data.user.id}`, {
        method: 'PATCH',
        cookie: b.cookie,
        data: { role: 'owner' },
      })
    ).status >= 400,
  )
  assert.ok(
    (
      await request('data/personal_songs', {
        method: 'POST',
        cookie: a.cookie,
        data: { owner_id: a.data.user.id, title: 'Denied direct draft' },
      })
    ).status >= 400,
  )
  const privateSong = await request('data/rpc/mutate_editor_song', {
    method: 'POST',
    cookie: a.cookie,
    data: {
      p_operation_id: randomUUID(),
      p_action: 'create_draft',
      p_song_id: null,
      p_personal_song_id: null,
      p_payload: { title: 'Private integration probe' },
    },
  })
  assert.equal(privateSong.status, 200, JSON.stringify(privateSong.data))
  const privateId = privateSong.data.row.id
  assert.deepEqual(
    (
      await request(`data/personal_songs?id=eq.${privateId}`, {
        cookie: b.cookie,
      })
    ).data,
    [],
  )
  assert.ok(
    (
      await request(`data/personal_songs?id=eq.${privateId}`, {
        method: 'PATCH',
        cookie: b.cookie,
        data: { title: 'denied' },
      })
    ).status >= 400,
  )
  const denied = await request('data/songs', {
    method: 'POST',
    cookie: a.cookie,
    data: { title: 'forbidden', slug: `forbidden-${runId}` },
  })
  assert.ok(denied.status >= 400)
  await admin.query("UPDATE public.users SET role='editor' WHERE id=$1", [
    a.data.user.id,
  ])
  assert.ok(
    (
      await request('data/songs', {
        method: 'POST',
        cookie: a.cookie,
        data: { title: 'Denied direct editor write', slug: `denied-${runId}` },
      })
    ).status >= 400,
  )
  const published = await request('data/rpc/mutate_editor_song', {
    method: 'POST',
    cookie: a.cookie,
    data: {
      p_operation_id: randomUUID(),
      p_action: 'save_published',
      p_song_id: null,
      p_personal_song_id: null,
      p_payload: { title: 'Integration probe', default_key: 'G', tags: ['QA'] },
    },
  })
  assert.equal(published.status, 200, JSON.stringify(published.data))
  songs.push(published.data.row.id)
  assert.ok(
    (
      await request(`data/songs?id=eq.${songs[0]}`, {
        method: 'PATCH',
        cookie: a.cookie,
        data: { is_deleted: true },
      })
    ).status >= 400,
    'Editors cannot bypass deletion permissions',
  )
  assert.ok(
    (
      await request(`data/songs?id=eq.${songs[0]}`, {
        method: 'PATCH',
        cookie: a.cookie,
        data: { star_count: 900 },
      })
    ).status >= 400,
    'Counters are server managed',
  )
  const set = await request('data/setlists', {
    method: 'POST',
    cookie: a.cookie,
    data: { owner_id: a.data.user.id, name: 'Integration set' },
  })
  assert.equal(set.status, 201, JSON.stringify(set.data))
  assert.equal(
    (
      await request('data/setlist_songs', {
        method: 'POST',
        cookie: a.cookie,
        data: { setlist_id: set.data[0].id, song_id: songs[0], position: 0 },
      })
    ).status,
    201,
  )
  const joined = await request(
    `data/setlists?id=eq.${set.data[0].id}&select=id,setlist_songs(id,songs(title))`,
    { cookie: a.cookie },
  )
  assert.equal(joined.data[0].setlist_songs[0].songs.title, 'Integration probe')
  assert.deepEqual(
    (
      await request(`data/setlists?id=eq.${set.data[0].id}`, {
        cookie: b.cookie,
      })
    ).data,
    [],
  )
  assert.ok(
    (
      await request('data/setlist_songs', {
        method: 'POST',
        cookie: b.cookie,
        data: { setlist_id: set.data[0].id, song_id: songs[0], position: 1 },
      })
    ).status >= 400,
  )
  assert.equal(
    (
      await request('data/user_starred_songs', {
        method: 'POST',
        cookie: b.cookie,
        data: { user_id: b.data.user.id, song_id: songs[0] },
      })
    ).status,
    201,
  )
  assert.equal(
    (await request(`data/songs?id=eq.${songs[0]}&select=star_count`)).data[0]
      .star_count,
    1,
  )
  const session = await request('data/sessions', {
    method: 'POST',
    cookie: a.cookie,
    data: {
      controller_id: a.data.user.id,
      code: 'PROBE123',
      chord_code: 'PROBE456',
    },
  })
  assert.equal(session.status, 201, JSON.stringify(session.data))
  assert.deepEqual((await request('data/sessions')).data, [])
  assert.equal(
    (
      await request(
        'data/sessions?or=(code.eq.PROBE123,chord_code.eq.PROBE123)',
      )
    ).data[0].id,
    session.data[0].id,
  )
  assert.equal(
    'email' in
      (await request('data/users?select=*', { cookie: a.cookie })).data[0],
    false,
    'Emails must not be public profile columns',
  )
  const submission = await request('site/submit', {
    method: 'POST',
    data: {
      kind: 'contacto',
      fields: {
        nombre: 'Integration',
        email: `a-${runId}@example.com`,
        mensaje: 'Private inbox probe',
      },
    },
  })
  assert.equal(submission.status, 201)
  assert.ok(
    (
      await request('data/rpc/list_site_inbox', {
        method: 'POST',
        cookie: b.cookie,
        data: {},
      })
    ).status >= 400,
  )
  await admin.query("UPDATE public.users SET role='admin' WHERE id=$1", [
    a.data.user.id,
  ])
  const siteInput = {
    p_collection: 'eventos',
    p_id: siteId,
    p_expected_revision: 0,
    p_action: 'save',
    p_data: { name: 'Private draft' },
  }
  const siteSave = (data, cookie = a.cookie) =>
    request('data/rpc/save_site_document', { method: 'POST', cookie, data })
  assert.equal((await siteSave(siteInput, b.cookie)).status, 403)
  const draft = await siteSave(siteInput)
  assert.equal(draft.status, 200, JSON.stringify(draft.data))
  assert.equal(draft.data[0].revision, 1)
  const publicRead = () =>
    request(
      `data/site_documents?select=collection,id,data&collection=eq.eventos&id=eq.${siteId}&published=eq.true`,
    )
  assert.deepEqual((await publicRead()).data, [])
  const publishedData = {
    name: 'Published event',
    date: '2026-12-01',
    time: '19:00',
    day: 'QA only',
  }
  assert.equal(
    (
      await siteSave({
        ...siteInput,
        p_expected_revision: 1,
        p_action: 'publish',
        p_data: publishedData,
      })
    ).status,
    200,
  )
  assert.deepEqual((await publicRead()).data[0].data, publishedData)
  assert.equal(
    (
      await siteSave({
        ...siteInput,
        p_expected_revision: 2,
        p_data: { name: 'New private draft' },
      })
    ).status,
    200,
  )
  assert.deepEqual(
    (await publicRead()).data[0].data,
    publishedData,
    'Saving a draft must not change the public version',
  )
  for (const cookie of [undefined, b.cookie]) {
    assert.ok(
      (
        await request(`data/site_documents?select=draft_data&id=eq.${siteId}`, {
          cookie,
        })
      ).status >= 400,
      'Draft columns must not be readable even on a published row',
    )
    assert.ok(
      (
        await request('data/rpc/list_site_documents', {
          method: 'POST',
          cookie,
          data: { p_collection: 'eventos' },
        })
      ).status >= 400,
    )
  }
  assert.ok(
    (
      await request(`data/site_documents?id=eq.${siteId}`, {
        method: 'PATCH',
        cookie: a.cookie,
        data: { data: { name: 'Bypass' } },
      })
    ).status >= 400,
  )
  const simultaneous = await Promise.all(
    ['First editor', 'Second editor'].map((name) =>
      siteSave({ ...siteInput, p_expected_revision: 3, p_data: { name } }),
    ),
  )
  assert.deepEqual(
    simultaneous.map((result) => result.status).sort(),
    [200, 409],
    'Concurrent editors must not silently overwrite each other',
  )
  const currentDraft = await request('data/rpc/list_site_documents', {
    method: 'POST',
    cookie: a.cookie,
    data: { p_collection: 'eventos' },
  })
  assert.equal(currentDraft.data.find((row) => row.id === siteId).revision, 4)
  assert.equal(
    (
      await siteSave({
        ...siteInput,
        p_expected_revision: 4,
        p_action: 'unpublish',
      })
    ).status,
    200,
  )
  assert.deepEqual((await publicRead()).data, [])
  const audit = await admin.query(
    'SELECT count(*)::int AS count FROM private.site_document_history WHERE collection=$1 AND document_id=$2',
    ['eventos', siteId],
  )
  assert.equal(audit.rows[0].count, 5)
  const inbox = await request('data/rpc/list_site_inbox', {
    method: 'POST',
    cookie: a.cookie,
    data: {},
  })
  assert.equal(inbox.status, 200)
  assert.ok(
    inbox.data.some((row) => row.payload.email === `a-${runId}@example.com`),
  )
  const activationToken = newToken()
  await admin.query(
    'INSERT INTO private.activation_tokens(token_hash,user_id) VALUES($1,$2)',
    [tokenHash(activationToken), b.data.user.id],
  )
  const activation = await request('auth/activate', {
    method: 'POST',
    data: { token: activationToken, password: `new-${password}` },
  })
  assert.equal(activation.status, 200)
  assert.equal(
    (await request('auth/session', { cookie: b.cookie })).data.session,
    null,
    'Activation revokes existing sessions',
  )
  assert.equal(
    (
      await request('auth/activate', {
        method: 'POST',
        data: { token: activationToken, password: `new-${password}` },
      })
    ).status,
    400,
    'Activation links can only be used once',
  )
  assert.equal(
    (
      await request('auth/logout', {
        method: 'POST',
        cookie: a.cookie,
        data: {},
      })
    ).status,
    200,
  )
  assert.equal(
    (await request('auth/session', { cookie: a.cookie })).data.session,
    null,
  )
  console.log(
    'PASS: auth, one-time activation and revocation, CSRF, role escalation rejection, private data isolation, catalog, nested setlists, stars, session codes and administrator-only public inbox',
  )
} finally {
  await admin.query(
    'DELETE FROM private.site_document_history WHERE collection=$1 AND document_id=$2',
    ['eventos', siteId],
  )
  await admin.query(
    'DELETE FROM public.site_documents WHERE collection=$1 AND id=$2',
    ['eventos', siteId],
  )
  await admin.query(
    "DELETE FROM private.site_inbox WHERE payload->>'email'=$1",
    [`a-${runId}@example.com`],
  )
  if (songs.length)
    await admin.query('DELETE FROM public.songs WHERE id=ANY($1::uuid[])', [
      songs,
    ])
  if (created.length)
    await admin.query('DELETE FROM public.users WHERE id=ANY($1::uuid[])', [
      created,
    ])
  await admin.end()
}
