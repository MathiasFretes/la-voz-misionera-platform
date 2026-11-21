import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nativeToken, nativeAuthAction } from '../native-session.mjs'

const token = `n_${'a'.repeat(43)}`
const device = { 'x-lvm-client': 'native', authorization: `Bearer ${token}` }
test('device credentials are explicit and never accepted from browser-origin or cookie requests', () => {
  assert.equal(nativeToken(device), token)
  for (const extra of [
    { origin: 'https://srv2137598.hstgr.cloud' },
    { 'sec-fetch-site': 'cross-site' },
    { cookie: '__Host-lvm_session=secret' },
    { 'x-lvm-client': 'web' },
    { authorization: `Bearer ${'a'.repeat(43)}` },
    { authorization: 'Bearer n_short' },
  ])
    assert.equal(nativeToken({ ...device, ...extra }), null)
})
test('native login has a separate route, exact action allowlist and no browser cookies', () => {
  assert.equal(nativeAuthAction('/api/native/auth/login', device), 'login')
  assert.equal(nativeAuthAction('/api/auth/login', device), null)
  assert.throws(
    () =>
      nativeAuthAction('/api/native/auth/login', {
        ...device,
        origin: 'https://evil.example',
      }),
    { status: 403 },
  )
  assert.throws(
    () =>
      nativeAuthAction('/api/native/auth/login', {
        ...device,
        cookie: 'anything',
      }),
    { status: 403 },
  )
  assert.throws(() => nativeAuthAction('/api/native/auth/activate', device), {
    status: 404,
  })
})
