import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nativeToken, nativeAuthAction } from '../native-session.mjs'

const token = `n_${'a'.repeat(43)}`
const device = { 'x-lvm-client': 'native', authorization: `Bearer ${token}` }
test('device credentials are explicit and never accepted from browser-origin or cookie requests', () => {
  assert.equal(nativeToken(device, true), token)
  for (const extra of [
    { origin: 'https://srv2137598.hstgr.cloud' },
    { 'sec-fetch-site': 'cross-site' },
    { cookie: '__Host-lvm_session=secret' },
    { 'x-lvm-client': 'web' },
    { authorization: `Bearer ${'a'.repeat(43)}` },
    { authorization: 'Bearer n_short' },
  ])
    assert.equal(nativeToken({ ...device, ...extra }, true), null)
})
test('native login has a separate route, exact action allowlist and no browser cookies', () => {
  assert.equal(
    nativeAuthAction('/api/native/auth/login', device, true),
    'login',
  )
  assert.equal(nativeAuthAction('/api/auth/login', device, true), null)
  assert.throws(
    () =>
      nativeAuthAction(
        '/api/native/auth/login',
        {
          ...device,
          origin: 'https://evil.example',
        },
        true,
      ),
    { status: 403 },
  )
  assert.throws(
    () =>
      nativeAuthAction(
        '/api/native/auth/login',
        {
          ...device,
          cookie: 'anything',
        },
        true,
      ),
    { status: 403 },
  )
  assert.throws(
    () => nativeAuthAction('/api/native/auth/activate', device, true),
    {
      status: 404,
    },
  )
})

test('native authentication and previously issued tokens fail closed without server opt-in', () => {
  for (const enabled of [undefined, false]) {
    assert.equal(nativeToken(device, enabled), null)
    for (const action of ['signup', 'login', 'session', 'logout', 'password'])
      assert.throws(
        () => nativeAuthAction(`/api/native/auth/${action}`, device, enabled),
        { status: 404 },
      )
    assert.equal(nativeAuthAction('/api/auth/session', {}, enabled), null)
  }
})
