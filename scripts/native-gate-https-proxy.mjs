import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:https'
import { request } from 'node:http'

assert.match(
  process.env.LVM_NATIVE_QA || '',
  /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/,
)
const run = process.env.LVM_NATIVE_QA
const uuid = /^[a-f0-9-]{36}$/
const server = createServer(
  {
    key: await readFile('/run/secrets/qa_tls_key'),
    cert: await readFile('/run/secrets/qa_tls_cert'),
  },
  (incoming, outgoing) => {
    if (
      incoming.headers.host !== 'lvm-qa.invalid:8443' ||
      !incoming.url?.startsWith('/api/')
    ) {
      outgoing.writeHead(421)
      outgoing.end()
      return
    }
    const upstream = request(
      {
        hostname: 'api-on',
        port: 4318,
        path: incoming.url,
        method: incoming.method,
        headers: { ...incoming.headers, host: 'api-on:4318' },
      },
      (result) => {
        // Only request metadata; never log authorization, cookies or request bodies.
        console.log(
          JSON.stringify({
            method: incoming.method,
            path: incoming.url.split('?')[0],
            status: result.statusCode,
            operation: uuid.test(incoming.headers['x-lvm-operation'] || '')
              ? incoming.headers['x-lvm-operation']
              : undefined,
            account: uuid.test(incoming.headers['x-lvm-account'] || '')
              ? incoming.headers['x-lvm-account']
              : undefined,
          }),
        )
        outgoing.writeHead(result.statusCode, {
          ...result.headers,
          'X-LVM-QA': run,
        })
        result.pipe(outgoing)
      },
    )
    upstream.on('error', () => {
      outgoing.writeHead(502, { 'X-LVM-QA': run })
      outgoing.end()
    })
    incoming.pipe(upstream)
  },
)
server.listen(8443, '0.0.0.0', () =>
  console.log('QA TLS proxy ready on the owned internal network'),
)
