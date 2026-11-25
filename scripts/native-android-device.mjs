import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export function validateQaDeviceSerial(serial) {
  assert.equal(typeof serial, 'string', 'Set LVM_NATIVE_QA_SERIAL explicitly')
  assert.match(serial, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)
  return serial
}

export function verifyQaApk(gate, build, apk) {
  assert.equal(build.gateRunId, gate.runId)
  assert.equal(build.clientCommit, gate.client.commit)
  assert.equal(build.apiCommit, gate.server.commit)
  assert.equal(build.apiImageId, gate.server.imageId)
  assert.equal(build.apiOrigin, 'https://lvm-qa.invalid:8443/api')
  assert.equal(build.applicationId, 'com.lavozmisionera.qa')
  assert.equal(build.caSha256, gate.android.caSha256)
  assert.equal(build.caScope, 'lvm-qa.invalid')
  assert.equal(build.tlsVerificationDisabled, false)
  assert.equal(build.overlaysRestored, true)
  assert.equal(build.exitCode, 0)
  assert.equal(build.apk.bytes, apk.length)
  assert.equal(build.apk.sha256, createHash('sha256').update(apk).digest('hex'))
}
