import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const serviceRepo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const worshipRepo =
  process.env.WORSHIP_REPO && resolve(process.env.WORSHIP_REPO)
const presenterRepo =
  process.env.PRESENTER_REPO && resolve(process.env.PRESENTER_REPO)

if (!worshipRepo || !presenterRepo) {
  throw new Error(
    'Set WORSHIP_REPO and PRESENTER_REPO to the checked-out suite branches',
  )
}
if (!existsSync(join(worshipRepo, 'node_modules/vite/bin/vite.js'))) {
  throw new Error(`Install Worship Web dependencies first: ${worshipRepo}`)
}
if (
  !existsSync(join(presenterRepo, 'node_modules/electron/dist/electron.exe'))
) {
  throw new Error(`Install Presenter dependencies first: ${presenterRepo}`)
}
if (!existsSync(join(serviceRepo, 'node_modules/.bin/playwright.cmd'))) {
  throw new Error(`Install Service dependencies first: ${serviceRepo}`)
}

const run = (command, args, cwd, env = process.env) => {
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

// A non-routable local value lets the Worship UI initialize. Playwright blocks
// all remote requests, so the handoff still proves the file-based offline path.
run(
  process.execPath,
  ['../../node_modules/vite/bin/vite.js', 'build'],
  join(worshipRepo, 'apps/web'),
  {
    ...process.env,
    VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
    VITE_SUPABASE_ANON_KEY: 'lvm-offline-contract-test',
  },
)
run('npm', ['run', 'build'], serviceRepo)
run('npm', ['run', 'build:electron:dev'], presenterRepo)
run(
  'npm',
  ['run', 'test:e2e', '--', 'e2e/platform-worship.spec.ts'],
  serviceRepo,
  {
    ...process.env,
    LVM_SUITE_E2E: '1',
    WORSHIP_REPO: worshipRepo,
    PRESENTER_REPO: presenterRepo,
    WORSHIP_URL: 'http://127.0.0.1:4174',
  },
)
