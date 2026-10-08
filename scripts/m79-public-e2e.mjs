import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const serviceRepo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webRepo =
  process.env.PUBLIC_WEB_REPO && resolve(process.env.PUBLIC_WEB_REPO)
if (!webRepo || !existsSync(join(webRepo, 'node_modules/vite/bin/vite.js')))
  throw new Error(
    'Set PUBLIC_WEB_REPO to LVM Web Pública and run npm ci there first',
  )

const serviceParser = readFileSync(
  join(serviceRepo, 'src/contracts/publicContent.ts'),
  'utf8',
)
const webParser = readFileSync(
  join(webRepo, 'src/data/publicContent.ts'),
  'utf8',
)
if (serviceParser !== webParser)
  throw new Error(
    'PublicContent 0.1 parsers differ between Service and Web Pública',
  )

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: command === 'npm' && process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}`)
}

run('npm', ['run', 'build'], webRepo)
run('npm', ['run', 'build'], serviceRepo, {
  ...process.env,
  VITE_WEB_PUBLICA_URL: 'http://127.0.0.1:4175',
})
run(
  'npm',
  ['run', 'test:e2e', '--', 'e2e/public-content.spec.ts'],
  serviceRepo,
  {
    ...process.env,
    LVM_PUBLIC_E2E: '1',
    PUBLIC_WEB_REPO: webRepo,
  },
)
