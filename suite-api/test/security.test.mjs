import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  passwordHash,
  passwordMatches,
  signDatabaseToken,
} from '../security.mjs'

test('passwords use salted scrypt hashes and reject incorrect passwords', async () => {
  const first = await passwordHash('correct horse battery staple')
  const second = await passwordHash('correct horse battery staple')
  assert.notEqual(first, second)
  assert.equal(
    await passwordMatches('correct horse battery staple', first),
    true,
  )
  assert.equal(await passwordMatches('wrong password', first), false)
})
test('database credentials contain a short expiration and an authenticated subject', () => {
  const token = signDatabaseToken(
    { role: 'lvm_user', sub: 'test-user' },
    'a'.repeat(64),
  )
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'))
  assert.equal(claims.sub, 'test-user')
  assert.ok(claims.exp > Date.now() / 1000)
  assert.ok(claims.exp < Date.now() / 1000 + 61)
})
