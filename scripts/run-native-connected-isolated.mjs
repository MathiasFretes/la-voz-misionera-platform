import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, mkdtemp, writeFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { dirname, resolve, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { writeFileSync } from 'node:fs'
import { redactNativeGateFailure } from './native-gate-context.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const client = resolve(root, '../LVM Worship')
const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()
assert.equal(
  git(client, 'status', '--porcelain'),
  '',
  'Client source must be clean',
)
git(root, 'diff', '--exit-code', 'HEAD', '--', 'suite-api')
const runId = randomUUID()
const project = `lvm-native-${runId.replaceAll('-', '').slice(0, 16)}`
const remote = `/tmp/${project}`
const secretDir = `${remote}/secrets`
const output = join(root, 'test-results/native-gate', runId)
await mkdir(output, { recursive: true })
const local = await mkdtemp(join(tmpdir(), 'lvm-native-gate-'))
const archive = join(local, 'source.tar')
execFileSync('git', [
  '-C',
  root,
  'archive',
  '--format=tar',
  '-o',
  archive,
  'HEAD',
  'suite-api',
])
const server = {
  commit: git(root, 'rev-parse', 'HEAD'),
  tree: git(root, 'rev-parse', 'HEAD^{tree}'),
  apiTree: git(root, 'rev-parse', 'HEAD:suite-api'),
}
const ssh = (script) => {
  try {
    return execFileSync(
      'ssh',
      ['-o', 'BatchMode=yes', 'hostinger-vps', 'sh', '-s'],
      {
        input: script,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      },
    )
  } catch (error) {
    writeFileSync(
      join(output, 'remote-failure.log'),
      redactNativeGateFailure(error.stderr || error.message),
      { mode: 0o600 },
    )
    // exec errors retain raw buffers and include stderr in message/stack.
    for (const key of ['stdout', 'stderr', 'output']) delete error[key]
    error.message = redactNativeGateFailure(error.message)
    error.stack = redactNativeGateFailure(error.stack)
    throw new Error(
      `Disposable QA remote operation failed (${error.status}); see redacted remote-failure.log`,
      { cause: error },
    )
  }
}
const compose = `docker compose --project-name ${project} -f ${remote}/source/suite-api/test/compose.integration.yaml -f ${remote}/ports.yaml`
const exports = `export LVM_QA_IMAGE=${project}-api LVM_QA_SECRET_DIR=${secretDir}`
let created = false,
  tunnel
try {
  ssh(`set -eu\ntest ! -e '${remote}'\nmkdir -m 700 '${remote}'\n`)
  created = true
  execFileSync('scp', [archive, `hostinger-vps:${remote}/source.tar`])
  const setup = `set -eu
umask 077
mkdir '${remote}/source' '${secretDir}'
tar -xf '${remote}/source.tar' -C '${remote}/source'
${exports}
for key in postgres_password api_password rest_password jwt_secret; do openssl rand -hex 32 > '${secretDir}/'"$key"; done
printf 'postgres://lvm_rest:%s@postgres:5432/lvm_worship' "$(cat '${secretDir}/rest_password')" > '${secretDir}/rest_uri'
chmod 644 '${secretDir}/'*
printf 'services: {}\n' > '${remote}/ports.yaml'
${compose} up -d --wait postgres
for migration in '${remote}/source/suite-api/schema/'*.sql; do
 case "$migration" in *.down.sql) continue ;; esac
 ${compose} exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 < "$migration" >/dev/null
done
{ printf "ALTER ROLE lvm_api PASSWORD '%s';\\n" "$(cat '${secretDir}/api_password')"; printf "ALTER ROLE lvm_rest PASSWORD '%s';\\n" "$(cat '${secretDir}/rest_password')"; } | ${compose} exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 >/dev/null
docker build --label org.opencontainers.image.revision=${server.commit} --label org.lvm.api-tree=${server.apiTree} -t ${project}-api '${remote}/source/suite-api'
${compose} up -d --no-build --wait rest api-on
python3 - <<'PY'
import subprocess,json
x=json.loads(subprocess.check_output(['docker','inspect','${project}-api-on-1']))[0]
address=x['NetworkSettings']['Networks']['${project}_default']['IPAddress']
assert address
print(json.dumps({'imageId':x['Image'],'address':address}))
PY
`
  const setupLog = ssh(setup)
  await writeFile(join(output, 'setup.log'), setupLog)
  const metadata = JSON.parse(setupLog.trim().split('\n').at(-1))
  const listener = createServer()
  listener.listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const localPort = listener.address().port
  await new Promise((ok, reject) =>
    listener.close((error) => (error ? reject(error) : ok())),
  )
  tunnel = spawn(
    'ssh',
    [
      '-N',
      '-o',
      'BatchMode=yes',
      '-o',
      'ExitOnForwardFailure=yes',
      '-L',
      `127.0.0.1:${localPort}:${metadata.address}:4318`,
      'hostinger-vps',
    ],
    { stdio: 'ignore' },
  )
  const apiUrl = `http://127.0.0.1:${localPort}/api`
  let ready = false
  for (let attempt = 0; attempt < 30; attempt++) {
    assert.equal(tunnel.exitCode, null, 'QA tunnel exited')
    try {
      if (
        (
          await globalThis.fetch(apiUrl + '/health', {
            signal: globalThis.AbortSignal.timeout(1000),
          })
        ).ok
      ) {
        ready = true
        break
      }
    } catch {
      /* Await the owned tunnel. */
    }
    await delay(200)
  }
  assert.ok(ready, 'Owned QA API tunnel is unavailable')
  const manifest = {
    schemaVersion: 1,
    purpose: 'lvm-native-disposable-gate',
    runId,
    project,
    sshHost: 'hostinger-vps',
    database: { name: 'lvm_worship', container: `${project}-postgres-1` },
    server: {
      ...server,
      container: `${project}-api-on-1`,
      imageId: metadata.imageId,
      address: metadata.address,
    },
    client: {
      root: client,
      commit: git(client, 'rev-parse', 'HEAD'),
      tree: git(client, 'rev-parse', 'HEAD^{tree}'),
    },
    apiUrl,
    origin: 'https://lvm-qa.invalid',
  }
  const path = join(output, 'manifest.json')
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n')
  execFileSync(
    process.execPath,
    [join(root, 'scripts/verify-native-connected.mjs')],
    {
      cwd: root,
      env: { ...process.env, LVM_NATIVE_GATE_MANIFEST: path },
      stdio: 'inherit',
    },
  )
} finally {
  if (tunnel && tunnel.exitCode === null) {
    tunnel.kill()
    await once(tunnel, 'exit')
  }
  if (created) {
    ssh(
      `set -eu\n${exports}\ntest "$(realpath '${remote}')" = '${remote}'\nif test -f '${remote}/ports.yaml'; then ${compose} down --remove-orphans; fi\ntest -z "$(docker ps -aq --filter label=com.docker.compose.project=${project})"\nrm -rf -- '${remote}'\n`,
    )
    await writeFile(
      join(output, 'cleanup.json'),
      JSON.stringify(
        {
          project,
          containersRemoved: true,
          temporarySecretsRemoved: true,
          productionTouched: false,
        },
        null,
        2,
      ),
    )
  }
  const location = await realpath(local)
  assert.equal(dirname(location), await realpath(tmpdir()))
  assert.ok(basename(location).startsWith('lvm-native-gate-'))
  await rm(location, { recursive: true })
}
