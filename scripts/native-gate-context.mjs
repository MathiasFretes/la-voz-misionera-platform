import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { URL } from 'node:url'
import { isIPv4 } from 'node:net'

const sha = /^[a-f0-9]{40}$/
const image = /^sha256:[a-f0-9]{64}$/
export function redactNativeGateFailure(value) {
  return String(value)
    .split(/\r?\n/)
    .map((line) =>
      /password|authorization|bearer|access_token|refresh_token|jwt_secret|cookie/i.test(
        line,
      )
        ? '[sensitive error line omitted]'
        : line
            .replace(/n_[A-Za-z0-9_-]{43}/g, '[device token omitted]')
            .replace(
              /\b[a-f0-9]{64}\b/gi,
              '[hex credential or digest omitted]',
            ),
    )
    .join('\n')
}
export function validateNativeGateManifest(value) {
  assert.equal(value.schemaVersion, 1)
  assert.equal(value.purpose, 'lvm-native-disposable-gate')
  assert.match(value.runId, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/)
  const project = `lvm-native-${value.runId.replaceAll('-', '').slice(0, 16)}`
  assert.equal(value.project, project)
  assert.equal(value.sshHost, 'hostinger-vps')
  assert.equal(value.database.name, 'lvm_worship')
  assert.equal(value.database.container, `${project}-postgres-1`)
  assert.equal(value.server.container, `${project}-api-on-1`)
  assert.equal(value.origin, 'https://lvm-qa.invalid')
  const url = new URL(value.apiUrl)
  assert.equal(url.protocol, 'http:')
  assert.equal(url.hostname, '127.0.0.1')
  assert.ok(Number(url.port) > 1024)
  assert.equal(url.pathname, '/api')
  assert.equal(url.search + url.hash + url.username + url.password, '')
  for (const commit of [
    value.client.commit,
    value.client.tree,
    value.server.commit,
    value.server.tree,
    value.server.apiTree,
  ])
    assert.match(commit, sha)
  assert.match(value.server.imageId, image)
  assert.ok(isIPv4(value.server.address))
  const [a, b] = value.server.address.split('.').map(Number)
  assert.ok(
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168),
  )
  return value
}

export function verifyNativeGateContainers(manifest, database, api) {
  validateNativeGateManifest(manifest)
  for (const container of [database, api]) {
    assert.equal(container.State.Running, true, 'QA container must be running')
    assert.equal(
      container.Config.Labels['com.docker.compose.project'],
      manifest.project,
    )
    assert.deepEqual(Object.keys(container.NetworkSettings.Networks), [
      `${manifest.project}_default`,
    ])
    for (const mount of container.Mounts) {
      if (mount.Type === 'bind')
        assert.ok(
          mount.Source.startsWith(`/tmp/${manifest.project}/secrets/`),
          'Only temporary QA secrets may be mounted',
        )
      else
        assert.equal(
          mount.Type,
          'tmpfs',
          'Persistent database mounts are forbidden',
        )
    }
  }
  assert.ok(
    database.Mounts.some(
      (m) => m.Type === 'tmpfs' && m.Destination === '/var/lib/postgresql/data',
    ) ||
      Object.hasOwn(
        database.HostConfig.Tmpfs || {},
        '/var/lib/postgresql/data',
      ),
    'Database data must be backed by tmpfs',
  )
  assert.equal(api.Image, manifest.server.imageId)
  assert.equal(
    api.Config.Labels['org.opencontainers.image.revision'],
    manifest.server.commit,
  )
  assert.equal(api.Config.Labels['org.lvm.api-tree'], manifest.server.apiTree)
  assert.ok(api.Config.Env.includes('LVM_NATIVE_AUTH_ENABLED=1'))
  assert.ok(api.Config.Env.includes('LVM_ORIGIN=https://lvm-qa.invalid'))
  assert.equal(
    api.NetworkSettings.Networks[`${manifest.project}_default`].IPAddress,
    manifest.server.address,
  )
  assert.ok(
    Object.values(api.NetworkSettings.Ports || {}).every(
      (binding) => binding === null,
    ),
    'QA API must not publish host ports',
  )
  assert.ok(
    !database.HostConfig.PortBindings ||
      Object.keys(database.HostConfig.PortBindings).length === 0,
  )
}

export async function loadNativeGateContext(
  path = process.env.LVM_NATIVE_GATE_MANIFEST,
) {
  assert.ok(
    path,
    'Use npm run test:native-connected:isolated; a verified disposable gate manifest is required',
  )
  const manifest = validateNativeGateManifest(
    JSON.parse(await readFile(path, 'utf8')),
  )
  const inspect = (name) =>
    JSON.parse(
      execFileSync(
        'ssh',
        ['-o', 'BatchMode=yes', manifest.sshHost, 'docker', 'inspect', name],
        { encoding: 'utf8' },
      ),
    )[0]
  verifyNativeGateContainers(
    manifest,
    inspect(manifest.database.container),
    inspect(manifest.server.container),
  )
  const network = JSON.parse(
    execFileSync(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        manifest.sshHost,
        'docker',
        'network',
        'inspect',
        `${manifest.project}_default`,
      ],
      { encoding: 'utf8' },
    ),
  )[0]
  assert.equal(
    network.Internal,
    true,
    'Native QA must not have an external network',
  )
  const sql = (statement) =>
    execFileSync(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        manifest.sshHost,
        'docker',
        'exec',
        '-i',
        manifest.database.container,
        'psql',
        '-X',
        '-qAt',
        '-U',
        'lvm_owner',
        '-d',
        manifest.database.name,
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { input: statement, encoding: 'utf8' },
    ).trim()
  assert.equal(
    sql(
      "SELECT count(*) FROM private.migrations WHERE version='012_editor_transactions';",
    ),
    '1',
  )
  return { manifest, sql }
}
