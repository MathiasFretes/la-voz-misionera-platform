import assert from 'node:assert/strict'
import console from 'node:console'
import { randomUUID, createHash, X509Certificate } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  writeFile,
  realpath,
  rm,
  readFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { dirname, resolve, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { writeFileSync } from 'node:fs'
import { redactNativeGateFailure } from './native-gate-context.mjs'
import { verifyNativeQaTls } from './native-qa-tls.mjs'
import { qaApiOrigin } from './native-android-overlay.mjs'
import { validateQaDeviceSerial } from './native-android-device.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const client = resolve(root, '../LVM Worship')
const androidDevice = process.argv.slice(2).includes('--android-device')
const androidBuild =
  androidDevice || process.argv.slice(2).includes('--android-build')
assert.ok(
  process.argv
    .slice(2)
    .every((arg) => ['--android-build', '--android-device'].includes(arg)),
  'Unsupported gate option',
)
const serial = androidDevice
  ? validateQaDeviceSerial(process.env.LVM_NATIVE_QA_SERIAL)
  : null
if (androidDevice)
  assert.equal(
    execFileSync(process.env.LVM_ADB || 'adb', ['-s', serial, 'get-state'], {
      encoding: 'utf8',
    }).trim(),
    'device',
    'Selected Android device must be connected before starting QA',
  )
let ownedAndroidPort
let androidTransportCleanup = null
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
  tunnel,
  tlsTunnel
try {
  ssh(`set -eu\ntest ! -e '${remote}'\nmkdir -m 700 '${remote}'\n`)
  created = true
  execFileSync('scp', [archive, `hostinger-vps:${remote}/source.tar`])
  const override = androidBuild
    ? {
        services: {
          'native-tls': {
            image: `${project}-api`,
            command: ['node', '/qa/native-proxy.mjs'],
            environment: { LVM_NATIVE_QA: runId },
            volumes: [`${remote}/native-proxy.mjs:/qa/native-proxy.mjs:ro`],
            secrets: ['qa_tls_key', 'qa_tls_cert'],
          },
        },
        secrets: {
          qa_tls_key: { file: `${secretDir}/qa_tls_key` },
          qa_tls_cert: { file: `${secretDir}/qa_tls_cert` },
        },
      }
    : { services: {} }
  await writeFile(join(local, 'override.json'), JSON.stringify(override))
  execFileSync('scp', [
    join(local, 'override.json'),
    `hostinger-vps:${remote}/ports.yaml`,
  ])
  if (androidBuild)
    execFileSync('scp', [
      join(root, 'scripts/native-gate-https-proxy.mjs'),
      `hostinger-vps:${remote}/native-proxy.mjs`,
    ])
  const tlsSetup = androidBuild
    ? `
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign' -subj '/CN=LVM Disposable QA ${runId}' -keyout '${secretDir}/qa_ca_key' -out '${secretDir}/qa_ca_cert' 2>/dev/null
openssl req -newkey rsa:2048 -nodes -subj '/CN=lvm-qa.invalid' -keyout '${secretDir}/qa_tls_key' -out '${remote}/server.csr' 2>/dev/null
printf 'subjectAltName=DNS:lvm-qa.invalid\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n' > '${remote}/server.ext'
openssl x509 -req -in '${remote}/server.csr' -CA '${secretDir}/qa_ca_cert' -CAkey '${secretDir}/qa_ca_key' -CAcreateserial -days 2 -extfile '${remote}/server.ext' -out '${secretDir}/qa_tls_cert' 2>/dev/null
openssl verify -CAfile '${secretDir}/qa_ca_cert' '${secretDir}/qa_tls_cert'
chmod 644 '${secretDir}/qa_ca_cert' '${secretDir}/qa_tls_key' '${secretDir}/qa_tls_cert' '${remote}/native-proxy.mjs'
`
    : ''
  const setup = `set -eu
umask 077
mkdir '${remote}/source' '${secretDir}'
tar -xf '${remote}/source.tar' -C '${remote}/source'
${exports}
for key in postgres_password api_password rest_password jwt_secret; do openssl rand -hex 32 > '${secretDir}/'"$key"; done
printf 'postgres://lvm_rest:%s@postgres:5432/lvm_worship' "$(cat '${secretDir}/rest_password')" > '${secretDir}/rest_uri'
chmod 644 '${secretDir}/'*
${tlsSetup}
${compose} up -d --wait postgres
for migration in '${remote}/source/suite-api/schema/'*.sql; do
 case "$migration" in *.down.sql) continue ;; esac
 ${compose} exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 < "$migration" >/dev/null
done
{ printf "ALTER ROLE lvm_api PASSWORD '%s';\\n" "$(cat '${secretDir}/api_password')"; printf "ALTER ROLE lvm_rest PASSWORD '%s';\\n" "$(cat '${secretDir}/rest_password')"; } | ${compose} exec -T postgres psql -U lvm_owner -d lvm_worship -v ON_ERROR_STOP=1 >/dev/null
docker build --label org.opencontainers.image.revision=${server.commit} --label org.lvm.api-tree=${server.apiTree} -t ${project}-api '${remote}/source/suite-api'
${compose} up -d --no-build --wait rest api-on ${androidBuild ? 'native-tls' : ''}
python3 - <<'PY'
import subprocess,json
x=json.loads(subprocess.check_output(['docker','inspect','${project}-api-on-1']))[0]
address=x['NetworkSettings']['Networks']['${project}_default']['IPAddress']
assert address
result={'imageId':x['Image'],'address':address}
${androidBuild ? `tls=json.loads(subprocess.check_output(['docker','inspect','${project}-native-tls-1']))[0]\nresult['tlsAddress']=tls['NetworkSettings']['Networks']['${project}_default']['IPAddress']` : ''}
print(json.dumps(result))
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
  if (androidBuild) {
    const caPath = join(output, 'qa-ca.pem')
    execFileSync('scp', [`hostinger-vps:${secretDir}/qa_ca_cert`, caPath])
    const ca = await readFile(caPath)
    const certificate = new X509Certificate(ca)
    assert.equal(certificate.ca, true)
    assert.ok(Date.parse(certificate.validTo) > Date.now())
    const tlsListener = createServer()
    tlsListener.listen(0, '127.0.0.1')
    await once(tlsListener, 'listening')
    const port = tlsListener.address().port
    await new Promise((ok, reject) =>
      tlsListener.close((error) => (error ? reject(error) : ok())),
    )
    tlsTunnel = spawn(
      'ssh',
      [
        '-N',
        '-o',
        'BatchMode=yes',
        '-o',
        'ExitOnForwardFailure=yes',
        '-L',
        `127.0.0.1:${port}:${metadata.tlsAddress}:8443`,
        'hostinger-vps',
      ],
      { stdio: 'ignore' },
    )
    let verification
    for (let attempt = 0; attempt < 30; attempt++) {
      assert.equal(tlsTunnel.exitCode, null)
      try {
        verification = await verifyNativeQaTls({ port, runId, ca })
        break
      } catch (error) {
        if (attempt === 29) throw error
        await delay(200)
      }
    }
    manifest.android = {
      apiOrigin: qaApiOrigin,
      caPath,
      caSha256: createHash('sha256').update(ca).digest('hex'),
      caExpiresAt: certificate.validTo,
      tlsContainer: `${project}-native-tls-1`,
      tlsAddress: metadata.tlsAddress,
      localTlsPort: port,
      verification,
    }
    ownedAndroidPort = port
    await writeFile(
      join(output, 'tls-verification.json'),
      JSON.stringify(verification, null, 2),
    )
  }
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
  if (androidBuild)
    execFileSync(
      process.execPath,
      [join(root, 'scripts/build-native-gate-android.mjs')],
      {
        cwd: root,
        env: { ...process.env, LVM_NATIVE_GATE_MANIFEST: path },
        stdio: 'inherit',
      },
    )
  if (androidDevice) {
    const child = spawn(
      process.execPath,
      [join(root, 'scripts/native-android-gate.mjs')],
      {
        cwd: root,
        env: { ...process.env, LVM_NATIVE_GATE_MANIFEST: path },
        stdio: 'inherit',
      },
    )
    const [code] = await once(child, 'exit')
    assert.equal(code, 0, 'Physical Android QA did not finish normally')
  }
} finally {
  if (serial && ownedAndroidPort) {
    try {
      const adbPath = process.env.LVM_ADB || 'adb'
      const mappings = execFileSync(
        adbPath,
        ['-s', serial, 'reverse', '--list'],
        { encoding: 'utf8' },
      )
      if (
        mappings.split(/\r?\n/).some((line) => {
          const fields = line.trim().split(/\s+/)
          return (
            fields[1] === 'tcp:8443' && fields[2] === `tcp:${ownedAndroidPort}`
          )
        })
      )
        execFileSync(adbPath, ['-s', serial, 'reverse', '--remove', 'tcp:8443'])
      androidTransportCleanup = true
    } catch {
      androidTransportCleanup = false
      console.warn(
        'Android transport cleanup could not be confirmed; device may be disconnected. Server cleanup continues.',
      )
    }
  }
  if (tlsTunnel && tlsTunnel.exitCode === null) {
    tlsTunnel.kill()
    await once(tlsTunnel, 'exit')
  }
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
          androidTransportCleanup,
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
