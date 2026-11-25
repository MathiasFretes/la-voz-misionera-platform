import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateNativeGateManifest,
  verifyNativeGateContainers,
  redactNativeGateFailure,
} from './native-gate-context.mjs'

test('failure diagnostics omit credentials and retain useful nonsecret errors', () => {
  const password = 'private-test-password'
  const token = 'n_' + 'a'.repeat(43)
  const secret = 'b'.repeat(64)
  const output = redactNativeGateFailure(
    `Traceback: invalid QA setup\nALTER ROLE lvm_api PASSWORD '${password}'\nAuthorization: Bearer ${token}\n${secret}`,
  )
  assert.ok(output.includes('invalid QA setup'))
  for (const value of [password, token, secret])
    assert.ok(!output.includes(value))
})

function fixture() {
  const runId = '01234567-89ab-4def-8abc-0123456789ab',
    project = 'lvm-native-0123456789ab4def'
  const manifest = {
    schemaVersion: 1,
    purpose: 'lvm-native-disposable-gate',
    runId,
    project,
    sshHost: 'hostinger-vps',
    database: { name: 'lvm_worship', container: `${project}-postgres-1` },
    server: {
      container: `${project}-api-on-1`,
      commit: 'a'.repeat(40),
      tree: 'b'.repeat(40),
      apiTree: 'c'.repeat(40),
      imageId: 'sha256:' + 'd'.repeat(64),
      address: '172.20.0.3',
    },
    client: {
      root: '/qa/client',
      commit: 'e'.repeat(40),
      tree: 'f'.repeat(40),
    },
    apiUrl: 'http://127.0.0.1:45001/api',
    origin: 'https://lvm-qa.invalid',
  }
  const base = {
    State: { Running: true },
    Config: { Labels: { 'com.docker.compose.project': project } },
    NetworkSettings: { Networks: { [`${project}_default`]: {} } },
    Mounts: [],
    HostConfig: {},
  }
  const db = JSON.parse(JSON.stringify(base))
  db.Mounts.push({ Type: 'tmpfs', Destination: '/var/lib/postgresql/data' })
  const api = JSON.parse(JSON.stringify(base))
  api.Image = manifest.server.imageId
  Object.assign(api.Config.Labels, {
    'org.opencontainers.image.revision': manifest.server.commit,
    'org.lvm.api-tree': manifest.server.apiTree,
  })
  api.Config.Env = [
    'LVM_NATIVE_AUTH_ENABLED=1',
    'LVM_ORIGIN=https://lvm-qa.invalid',
  ]
  api.NetworkSettings.Ports = {
    '4318/tcp': null,
  }
  api.NetworkSettings.Networks[`${project}_default`].IPAddress =
    manifest.server.address
  return { manifest, db, api }
}
test('accepts current provenance only for an owned disposable cluster', () => {
  const { manifest, db, api } = fixture()
  verifyNativeGateContainers(manifest, db, api)
})
test('accepts Docker Compose tmpfs represented in HostConfig', () => {
  const { manifest, db, api } = fixture()
  db.Mounts = []
  db.HostConfig.Tmpfs = { '/var/lib/postgresql/data': '' }
  verifyNativeGateContainers(manifest, db, api)
})
test('rejects a database with no explicit ephemeral data mount', () => {
  const { manifest, db, api } = fixture()
  db.Mounts = []
  assert.throws(() => verifyNativeGateContainers(manifest, db, api))
})
for (const [label, change] of [
  [
    'production endpoint',
    (m) => {
      m.apiUrl = 'https://srv2137598.hstgr.cloud/api'
    },
  ],
  [
    'production container',
    (m) => {
      m.database.container = 'lvm-worship-postgres-1'
    },
  ],
  [
    'unrelated project',
    (m) => {
      m.project = 'lvm-worship'
    },
  ],
  [
    'missing provenance',
    (m) => {
      m.server.commit = ''
    },
  ],
])
  test(`rejects ${label}`, () => {
    const { manifest } = fixture()
    change(manifest)
    assert.throws(() => validateNativeGateManifest(manifest))
  })
for (const [label, change] of [
  [
    'persistent database volume',
    ({ db }) => {
      db.Mounts = [{ Type: 'volume', Destination: '/var/lib/postgresql/data' }]
    },
  ],
  [
    'production secrets',
    ({ api }) => {
      api.Mounts = [
        {
          Type: 'bind',
          Source: '/srv/apps/la-voz-misionera/secrets/jwt_secret',
        },
      ]
    },
  ],
  [
    'external database port',
    ({ db }) => {
      db.HostConfig.PortBindings = {
        '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '5432' }],
      }
    },
  ],
  [
    'unexpected image',
    ({ api }) => {
      api.Image = 'sha256:' + '0'.repeat(64)
    },
  ],
  [
    'shared network',
    ({ api }) => {
      api.NetworkSettings.Networks = { 'shared-proxy': {} }
    },
  ],
  [
    'public API binding',
    ({ api }) => {
      api.NetworkSettings.Ports['4318/tcp'] = [
        { HostIp: '0.0.0.0', HostPort: '45000' },
      ]
    },
  ],
])
  test(`rejects ${label}`, () => {
    const data = fixture()
    change(data)
    assert.throws(() =>
      verifyNativeGateContainers(data.manifest, data.db, data.api),
    )
  })
