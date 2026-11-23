import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

// Only the disposable Compose service names are allowed; no production override.
const origin = 'https://lvm-qa.invalid'
const off = ['http://api-off:4318', 'http://api-disabled:4318']
const on = 'http://api-on:4318'
const email = `native-mode-${randomUUID()}@example.invalid`
const password = randomUUID()
async function request(
  base,
  path,
  { method = 'GET', data, cookie, token, native = false } = {},
) {
  assert.ok([...off, on].includes(base))
  const response = await fetch(`${base}/api/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(native ? { 'X-LVM-Client': 'native' } : { Origin: origin }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
const signup = await request(off[0], 'auth/signup', {
  method: 'POST',
  data: { email, password },
})
assert.equal(signup.status, 201)
let cookie = signup.cookie
const login = await request(on, 'native/auth/login', {
  method: 'POST',
  native: true,
  data: { email, password },
})
assert.equal(login.status, 200)
const token = login.data.session.access_token
assert.match(token, /^n_[\w-]{43}$/)
assert.equal(login.cookie, undefined)
const draft = await request(on, 'data/rpc/mutate_editor_song', {
  method: 'POST',
  native: true,
  token,
  data: {
    p_operation_id: randomUUID(),
    p_action: 'create_draft',
    p_song_id: null,
    p_personal_song_id: null,
    p_payload: { title: 'Native isolated draft' },
  },
})
assert.equal(draft.status, 200)
const id = draft.data.row.id
for (const base of off) {
  for (const action of ['signup', 'login', 'session', 'logout', 'password']) {
    const r = await request(base, `native/auth/${action}`, {
      native: true,
      token,
      method: action === 'session' ? 'GET' : 'POST',
      data: action === 'session' ? undefined : { email, password },
    })
    assert.equal(r.status, 404, `${base} native ${action} must be off`)
  }
  const denied = await request(base, `data/personal_songs?id=eq.${id}`, {
    native: true,
    token,
  })
  assert.ok(
    denied.status >= 400 || denied.data.length === 0,
    'Previously issued native token exposed private data while disabled',
  )
  const session = await request(base, 'auth/session', { native: true, token })
  assert.equal(session.data.session, null)
  const write = await request(base, 'data/rpc/mutate_editor_song', {
    method: 'POST',
    native: true,
    token,
    data: {
      p_operation_id: randomUUID(),
      p_action: 'create_draft',
      p_song_id: null,
      p_personal_song_id: null,
      p_payload: { title: 'Denied while off' },
    },
  })
  assert.ok(write.status >= 400)
}
for (const base of [...off, on]) {
  const session = await request(base, 'auth/session', { cookie })
  assert.equal(session.data.session.user.id, signup.data.user.id)
  const read = await request(base, `data/personal_songs?id=eq.${id}`, {
    cookie,
  })
  assert.equal(read.status, 200)
  assert.equal(read.data.length, 1)
}
assert.equal(
  (
    await request(on, `data/personal_songs?id=eq.${id}`, {
      native: true,
      token,
    })
  ).data.length,
  1,
)
const deniedPublish = await request(on, 'data/rpc/mutate_editor_song', {
  method: 'POST',
  native: true,
  token,
  data: {
    p_operation_id: randomUUID(),
    p_action: 'save_published',
    p_song_id: null,
    p_personal_song_id: null,
    p_payload: { title: 'Denied publish', default_key: 'G', tags: ['QA'] },
  },
})
assert.ok(deniedPublish.status >= 400)
const newPassword = randomUUID()
const changed = await request(off[0], 'auth/password', {
  method: 'POST',
  cookie,
  data: { password: newPassword },
})
assert.equal(changed.status, 200)
cookie = changed.cookie
assert.equal(
  (await request(on, 'native/auth/session', { native: true, token })).data
    .session,
  null,
)
assert.equal(
  (
    await request(on, 'native/auth/login', {
      method: 'POST',
      native: true,
      data: { email, password },
    })
  ).status,
  401,
)
const fresh = await request(on, 'native/auth/login', {
  method: 'POST',
  native: true,
  data: { email, password: newPassword },
})
assert.equal(fresh.status, 200)
assert.equal(
  (
    await request(on, 'native/auth/logout', {
      method: 'POST',
      native: true,
      token: fresh.data.session.access_token,
      data: {},
    })
  ).status,
  200,
)
assert.equal(
  (
    await request(on, 'native/auth/session', {
      native: true,
      token: fresh.data.session.access_token,
    })
  ).data.session,
  null,
)
assert.equal(
  (await request(off[0], 'auth/session', { cookie })).data.session.user.id,
  signup.data.user.id,
)
console.log(
  'PASS default/explicit-off native routes and old Bearer rejected; enabled native permissions/logout/password revocation; web sessions work in every mode',
)
