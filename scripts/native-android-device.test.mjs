import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  validateQaDeviceSerial,
  verifyQaApk,
} from './native-android-device.mjs'

test('device selection must be explicit and cannot become an ADB option', () => {
  for (const serial of [undefined, '', '-e', 'device other', 'a\nother'])
    assert.throws(() => validateQaDeviceSerial(serial))
  assert.equal(validateQaDeviceSerial('AE6RUT4C25003519'), 'AE6RUT4C25003519')
})

test('APK must match the current live gate, client, API, certificate and bytes', () => {
  const apk = Buffer.from('QA fixture')
  const gate = {
    runId: 'run',
    client: { commit: 'client' },
    server: { commit: 'server', imageId: 'image' },
    android: { caSha256: 'ca' },
  }
  const build = {
    gateRunId: 'run',
    clientCommit: 'client',
    apiCommit: 'server',
    apiImageId: 'image',
    apiOrigin: 'https://lvm-qa.invalid:8443/api',
    applicationId: 'com.lavozmisionera.qa',
    caSha256: 'ca',
    caScope: 'lvm-qa.invalid',
    tlsVerificationDisabled: false,
    overlaysRestored: true,
    exitCode: 0,
    apk: {
      bytes: apk.length,
      sha256: createHash('sha256').update(apk).digest('hex'),
    },
  }
  verifyQaApk(gate, build, apk)
  for (const key of [
    'gateRunId',
    'clientCommit',
    'apiCommit',
    'apiImageId',
    'caSha256',
    'applicationId',
  ])
    assert.throws(() => verifyQaApk(gate, { ...build, [key]: 'other' }, apk))
  assert.throws(() => verifyQaApk(gate, build, Buffer.from('old APK')))
  assert.throws(() =>
    verifyQaApk(gate, { ...build, tlsVerificationDisabled: true }, apk),
  )
})
