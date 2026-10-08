import { spawnSync } from 'node:child_process'
import process from 'node:process'

for (const name of ['WORSHIP_REPO', 'PRESENTER_REPO', 'PUBLIC_WEB_REPO']) {
  if (!process.env[name]) throw new Error(`Set ${name} to the suite checkout path`)
}

for (const command of ['test:suite', 'test:public-preview']) {
  const result = spawnSync('npm', ['run', command], {
    cwd: process.cwd(),
    env: { ...process.env, LVM_DEMO_CAPTURE: '1' },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed`)
}

process.stdout.write('M7.9D offline demo passed: Service, Worship, Presenter, Web Pública\n')
