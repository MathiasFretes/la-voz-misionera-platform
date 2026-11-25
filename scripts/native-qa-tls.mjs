import assert from 'node:assert/strict'
import { request } from 'node:https'
import { qaHostname } from './native-android-overlay.mjs'

function probe(port, runId, ca, servername = qaHostname) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: qaHostname,
        servername,
        port,
        path: '/api/health',
        ca,
        headers: { Host: `${qaHostname}:8443` },
        lookup: (_host, options, callback) =>
          callback(
            null,
            options.all ? [{ address: '127.0.0.1', family: 4 }] : '127.0.0.1',
            4,
          ),
      },
      (response) => {
        response.resume()
        response.once('end', () => {
          try {
            assert.equal(response.statusCode, 200)
            assert.equal(response.headers['x-lvm-qa'], runId)
            resolve()
          } catch (error) {
            reject(error)
          }
        })
      },
    )
    req.setTimeout(2000, () =>
      req.destroy(new Error('QA TLS health timed out')),
    )
    req.once('error', reject)
    req.end()
  })
}

export async function verifyNativeQaTls({ port, runId, ca }) {
  await probe(port, runId, ca)
  await assert.rejects(probe(port, runId, undefined), (error) =>
    [
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'SELF_SIGNED_CERT_IN_CHAIN',
      'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      'DEPTH_ZERO_SELF_SIGNED_CERT',
    ].includes(error.code),
  )
  await assert.rejects(probe(port, runId, ca, 'wrong-lvm-qa.invalid'), {
    code: 'ERR_TLS_CERT_ALTNAME_INVALID',
  })
  return {
    scopedCaAccepted: true,
    systemTrustRejected: true,
    incorrectHostnameRejected: true,
    tlsVerificationDisabled: false,
  }
}
