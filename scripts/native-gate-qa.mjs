import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Fixed disposable database and loopback port, never a production target.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const run = 'native-gate-20261122'
const stage = `/srv/apps/la-voz-misionera/planning-${run}`
const database = 'lvm_planning_qa_20261121'
const remote = (script) => {
  const input = `set -eu\n${script}\n`
  writeFileSync(join(tmpdir(), 'native-gate-qa-last-command.sh'), input)
  return execFileSync(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      'hostinger-vps',
      `qa_script=$(mktemp /tmp/lvm-native-gate.XXXXXX); trap 'rm -f "$qa_script"' EXIT; cat >"$qa_script"; sh "$qa_script"`,
    ],
    { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  )
}
const action = process.argv[2]
assert.ok(
  ['prepare', 'start', 'cleanup'].includes(action),
  'Use prepare, start or cleanup',
)

function startQa(manifest) {
  const { image, serviceCommit, sourceArchiveSha256: hash } = manifest
  assert.equal(manifest.database, database)
  assert.equal(manifest.run, run)
  assert.match(serviceCommit, /^[a-f0-9]{40}$/)
  assert.match(hash, /^[a-f0-9]{64}$/)
  assert.equal(image, `lvm-native-gate:20261122-${serviceCommit.slice(0, 7)}`)
  return remote(`
cd /srv/apps/la-voz-misionera
test "$(sha256sum '${stage}/suite-api.tar.gz' | cut -d ' ' -f 1)" = '${hash}'
test "$(cat '${stage}/qa-database')" = '${database}'
test "$(docker compose exec -T postgres psql -U lvm_owner -d '${database}' -Atc 'SELECT count(*) FROM private.migrations')" = '10'
test "$(docker compose exec -T postgres psql -U lvm_owner -d '${database}' -Atc 'SELECT count(*) FROM public.users')" = '0'
for name in lvm-planning-qa-api lvm-planning-qa-rest; do
  if docker inspect "$name" >/dev/null 2>&1; then test "$(docker inspect -f '{{index .Config.Labels "lvm.qa.run"}}' "$name")" = '${run}'; fi
done
docker build --label 'lvm.qa.run=${run}' --label 'org.opencontainers.image.revision=${serviceCommit}' -t '${image}' '${stage}/source' > '${stage}/build.log' 2>&1
if docker network inspect lvm-planning-qa-front >/dev/null 2>&1; then
  test "$(docker network inspect -f '{{index .Labels "lvm.qa.run"}}' lvm-planning-qa-front)" = '${run}'
else
  docker network create --label 'lvm.qa.run=${run}' lvm-planning-qa-front
fi
if ! docker inspect lvm-planning-qa-rest >/dev/null 2>&1; then
docker run -d --name lvm-planning-qa-rest --label 'lvm.qa.run=${run}' --network lvm-worship_database --user 1000:1000 --security-opt no-new-privileges:true --memory 256m \
  --mount 'type=bind,src=${stage}/secrets/rest_uri,dst=/run/secrets/rest_uri,readonly' \
  --mount 'type=bind,src=${stage}/secrets/jwt_secret,dst=/run/secrets/jwt_secret,readonly' \
  -e PGRST_DB_URI=@/run/secrets/rest_uri -e PGRST_JWT_SECRET=@/run/secrets/jwt_secret -e PGRST_DB_ANON_ROLE=lvm_anon -e PGRST_DB_SCHEMAS=public -e PGRST_DB_MAX_ROWS=10000 -e PGRST_OPENAPI_MODE=disabled -e PGRST_LOG_LEVEL=error \
  postgrest/postgrest:v16.0@sha256:45674266ef004bc6676f98b12132f1da042de8b5237eff4e7af3c7bf6c510bfb
fi
if ! docker inspect lvm-planning-qa-api >/dev/null 2>&1; then
docker run -d --name lvm-planning-qa-api --label 'lvm.qa.run=${run}' --network lvm-planning-qa-front --security-opt no-new-privileges:true --memory 512m -p 127.0.0.1:4319:4318 \
  --mount 'type=bind,src=${stage}/secrets/api_password,dst=/run/secrets/api_password,readonly' \
  --mount 'type=bind,src=${stage}/secrets/jwt_secret,dst=/run/secrets/jwt_secret,readonly' \
  -e LVM_ORIGIN=https://srv2137598.hstgr.cloud -e LVM_DATABASE=${database} -e LVM_REST_URL=http://lvm-planning-qa-rest:3000 '${image}'
docker network connect lvm-worship_database lvm-planning-qa-api
fi
attempt=0
until curl -fsS http://127.0.0.1:4319/api/health >/dev/null; do
  attempt=$((attempt+1)); test "$attempt" -lt 30; sleep 1
done
docker image inspect -f '{{.Id}}' '${image}'
printf 'PASS: fresh isolated PostgreSQL/API ready on loopback only; production untouched\n'
`)
}
if (action === 'start') {
  const manifest = JSON.parse(remote(`cat '${stage}/manifest.json'`))
  console.log(startQa(manifest))
  console.log(JSON.stringify(manifest, null, 2))
  process.exit(0)
}

if (action === 'cleanup') {
  console.log(
    remote(`
cd /srv/apps/la-voz-misionera
test "$(cat '${stage}/qa-database')" = '${database}'
for name in lvm-planning-qa-api lvm-planning-qa-rest; do
  test "$(docker inspect -f '{{index .Config.Labels "lvm.qa.run"}}' "$name")" = '${run}'
done
if docker inspect lvm-native-qa-tls >/dev/null 2>&1; then
  test "$(docker inspect -f '{{index .Config.Labels "lvm.qa.run"}}' lvm-native-qa-tls)" = '${run}'
fi
test "$(docker network inspect -f '{{index .Labels "lvm.qa.run"}}' lvm-planning-qa-front)" = '${run}'
image=$(cat '${stage}/qa-image')
test "$(docker image inspect -f '{{index .Config.Labels "lvm.qa.run"}}' "$image")" = '${run}'
test "$(docker compose exec -T postgres psql -U lvm_owner -d '${database}' -Atc 'SELECT (SELECT count(*) FROM public.users)+(SELECT count(*) FROM private.churches)')" = '0'
if docker inspect lvm-native-qa-tls >/dev/null 2>&1; then
  docker rm -f lvm-native-qa-tls
fi
docker rm -f lvm-planning-qa-api lvm-planning-qa-rest
docker compose exec -T postgres dropdb -U lvm_owner '${database}'
docker network rm lvm-planning-qa-front
docker image rm "$image"
test "$(readlink -f '${stage}/secrets')" = '${stage}/secrets'
find '${stage}/secrets' -maxdepth 1 -type f -delete
rmdir '${stage}/secrets'
printf 'PASS: only marked native QA containers, empty QA database, network, image and temporary secret copies removed\n'
`),
  )
  process.exit(0)
}

const git = (...args) =>
  execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim()
const serviceCommit = git('rev-parse', 'HEAD')
const apiTree = git('rev-parse', 'HEAD:suite-api')
const clientCommit = execFileSync(
  'git',
  ['-C', resolve(root, '../LVM Worship'), 'rev-parse', 'HEAD'],
  { encoding: 'utf8' },
).trim()
for (const sha of [serviceCommit, apiTree, clientCommit])
  assert.match(sha, /^[a-f0-9]{40}$/)
assert.equal(
  git('status', '--porcelain', '--', 'suite-api'),
  '',
  'API must match its recorded commit',
)
const output = join(tmpdir(), run)
await mkdir(output, { recursive: true })
const archive = join(output, 'suite-api.tar.gz')
execFileSync('git', [
  '-C',
  root,
  'archive',
  '--format=tar.gz',
  `--output=${archive}`,
  'HEAD',
  'suite-api',
])
const hash = createHash('sha256')
  .update(await readFile(archive))
  .digest('hex')
const image = `lvm-native-gate:20261122-${serviceCommit.slice(0, 7)}`
console.log(
  remote(`
cd /srv/apps/la-voz-misionera
test ! -e '${stage}'
test -z "$(docker compose exec -T postgres psql -U lvm_owner -d postgres -Atc "SELECT datname FROM pg_database WHERE datname='${database}'")"
for name in lvm-planning-qa-api lvm-planning-qa-rest; do
  if docker inspect "$name" >/dev/null 2>&1; then echo 'QA container already exists' >&2; exit 1; fi
done
if docker network inspect lvm-planning-qa-front >/dev/null 2>&1; then echo 'QA network already exists' >&2; exit 1; fi
test "$(docker compose exec -T postgres psql -U lvm_owner -d postgres -Atc "SELECT count(*) FROM pg_roles WHERE rolname IN ('lvm_anon','lvm_user','lvm_rest','lvm_api')")" = '4'
umask 077
mkdir -m 700 '${stage}'
printf '%s' '${database}' > '${stage}/qa-database'
printf '%s' '${image}' > '${stage}/qa-image'
`),
)
execFileSync('scp', ['-q', archive, `hostinger-vps:${stage}/suite-api.tar.gz`])
const manifest = {
  run,
  database,
  serviceCommit,
  apiTree,
  clientCommit,
  sourceArchiveSha256: hash,
  image,
  loopback: '127.0.0.1:4319',
  productionDeploymentChanged: false,
}
await writeFile(
  join(output, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
)
execFileSync('scp', [
  '-q',
  join(output, 'manifest.json'),
  `hostinger-vps:${stage}/manifest.json`,
])
console.log(
  remote(`
cd /srv/apps/la-voz-misionera
test "$(sha256sum '${stage}/suite-api.tar.gz' | cut -d ' ' -f 1)" = '${hash}'
mkdir -m 700 '${stage}/source' '${stage}/secrets'
tar xzf '${stage}/suite-api.tar.gz' -C '${stage}/source' --strip-components=1
cp secrets/api_password '${stage}/secrets/api_password'
openssl rand -hex 32 > '${stage}/secrets/jwt_secret'
python3 - <<'PY'
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
root=Path('/srv/apps/la-voz-misionera')
uri=urlsplit((root/'secrets/rest_uri').read_text().strip())
assert uri.hostname == 'postgres'
assert uri.path == '/lvm_worship'
(root/'planning-${run}/secrets/rest_uri').write_text(urlunsplit((uri.scheme,uri.netloc,'/${database}',uri.query,uri.fragment)))
PY
chown 1000:1000 '${stage}/secrets/'*
chmod 400 '${stage}/secrets/'*
docker compose exec -T postgres createdb -U lvm_owner -T template0 '${database}'
docker compose exec -T postgres psql -U lvm_owner -d postgres -v ON_ERROR_STOP=1 -c 'REVOKE ALL ON DATABASE ${database} FROM PUBLIC; GRANT CONNECT ON DATABASE ${database} TO lvm_api,lvm_rest;'
for migration in '${stage}/source/schema/'*.sql; do
  docker compose exec -T postgres psql -U lvm_owner -d '${database}' -v ON_ERROR_STOP=1 < "$migration" >/dev/null
done
test "$(docker compose exec -T postgres psql -U lvm_owner -d '${database}' -Atc 'SELECT count(*) FROM private.migrations')" = '10'
test "$(docker compose exec -T postgres psql -U lvm_owner -d '${database}' -Atc 'SELECT count(*) FROM public.users')" = '0'
`),
)
console.log(startQa(manifest))
console.log(JSON.stringify(manifest, null, 2))
