import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

// This preflight intentionally cannot target the production database/API.
const api = 'http://127.0.0.1:54319/api'
const origin = 'https://srv2137598.hstgr.cloud'
const { createDeviceTransport } = await import(
  pathToFileURL(
    resolve('../LVM Worship/apps/mobile/src/lib/deviceTransport.ts'),
  ).href
)
const stored = new Map()
const storage = {
  getItem: async (key) => stored.get(key) || null,
  setItem: async (key, value) => {
    stored.set(key, value)
  },
  removeItem: async (key) => {
    stored.delete(key)
  },
}
const transport = createDeviceTransport({
  apiUrl: `${origin}/api`,
  storage,
  fetcher: async (input, init) => {
    const response = await globalThis.fetch(
      `${api}${new globalThis.URL(input).pathname.slice('/api'.length)}${new globalThis.URL(input).search}`,
      init,
    )
    // The SSH tunnel changes only the transport address, not the app origin.
    return new globalThis.Response(await response.arrayBuffer(), {
      status: response.status,
      headers: response.headers,
    })
  },
})
const email = `native-qa-${randomUUID()}@example.com`
const password = randomUUID()
let userId
const input = (value) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(value),
})
try {
  const created = await transport.fetch(
    `${origin}/api/auth/signup`,
    input({ email, password }),
  )
  assert.equal(created.status, 201)
  assert.equal(created.headers.get('set-cookie'), null)
  const session = (await created.json()).session
  userId = session.user.id
  assert.match(session.access_token, /^n_[A-Za-z0-9_-]{43}$/)
  assert.equal((await transport.readStoredSession()).user.id, userId)
  const own = await transport.fetch(
    `${origin}/api/data/users?select=id&limit=10`,
  )
  assert.equal(own.status, 200)
  assert.deepEqual(
    (await own.json()).map((row) => row.id),
    [userId],
  )
  const profile = await transport.fetch(`${origin}/api/auth/session`)
  const current = (await profile.json()).session
  assert.equal(current.user.id, userId)
  assert.equal(current.access_token, session.access_token)
  assert.deepEqual(current.user.memberships, [])
  const signedOut = await transport.fetch(
    `${origin}/api/auth/logout`,
    input({}),
  )
  assert.equal(signedOut.status, 200)
  assert.equal(signedOut.headers.get('set-cookie'), null)
  assert.equal(await transport.readStoredSession(), null)
  const rejected = await globalThis.fetch(`${api}/data/users?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'X-LVM-Client': 'native',
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ display_name: 'Revoked' }),
  })
  assert.equal(rejected.status, 403)
  const relogin = await transport.fetch(
    `${origin}/api/auth/login`,
    input({ email, password }),
  )
  assert.equal(relogin.status, 200)
  assert.notEqual(
    (await relogin.json()).session.access_token,
    session.access_token,
  )
  const browser = await globalThis.fetch(`${api}/auth/login`, {
    ...input({ email, password }),
    headers: { Origin: origin, 'Content-Type': 'application/json' },
  })
  assert.equal(browser.status, 200)
  const cookie = browser.headers.get('set-cookie').split(';')[0]
  assert.equal(
    (await browser.json()).session.access_token,
    undefined,
    'Web sessions never expose the opaque cookie token',
  )
  const csrf = await globalThis.fetch(`${api}/data/users`, {
    ...input({ display_name: 'Denied' }),
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
  })
  assert.equal(csrf.status, 403)
  const browserNative = await globalThis.fetch(`${api}/native/auth/login`, {
    ...input({ email, password }),
    headers: {
      Origin: origin,
      'X-LVM-Client': 'native',
      'Content-Type': 'application/json',
    },
  })
  assert.equal(browserNative.status, 403)
  const deviceAsCookie = await globalThis.fetch(`${api}/auth/session`, {
    headers: { Cookie: `__Host-lvm_session=${session.access_token}` },
  })
  assert.equal((await deviceAsCookie.json()).session, null)
  const change = await globalThis.fetch(`${api}/auth/password`, {
    ...input({ password: randomUUID() }),
    headers: {
      Origin: origin,
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
  })
  assert.equal(change.status, 200)
  const revoked = await transport.fetch(`${origin}/api/auth/session`)
  assert.equal((await revoked.json()).session, null)
  assert.equal(await transport.readStoredSession(), null)
  assert.equal(stored.size, 0)
  globalThis.console.log(
    'PASS: native transport and actual isolated PostgreSQL/API; shared account, device-only opaque token, cookie-free login, session restoration, private data, browser CSRF protection and immediate password-change revocation',
  )
} finally {
  {
    assert.match(email, /^native-qa-[a-f0-9-]{36}@example\.com$/)
    execFileSync(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        'hostinger-vps',
        `cd /srv/apps/la-voz-misionera && docker compose exec -T postgres psql -U lvm_owner -d lvm_planning_qa_20261121 -v ON_ERROR_STOP=1 -c "DELETE FROM public.users WHERE id IN (SELECT user_id FROM private.credentials WHERE email='${email}')"`,
      ],
      { stdio: 'pipe' },
    )
  }
}
