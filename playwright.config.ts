import { defineConfig } from '@playwright/test'
import { join } from 'node:path'

const suite = process.env.LVM_SUITE_E2E === '1'
const publicPreview = process.env.LVM_PUBLIC_E2E === '1'
const worshipRepo = process.env.WORSHIP_REPO
const presenterRepo = process.env.PRESENTER_REPO
const publicWebRepo = process.env.PUBLIC_WEB_REPO

if (suite && (!worshipRepo || !presenterRepo)) {
  throw new Error('LVM_SUITE_E2E requires WORSHIP_REPO and PRESENTER_REPO')
}
if (publicPreview && !publicWebRepo) {
  throw new Error('LVM_PUBLIC_E2E requires PUBLIC_WEB_REPO')
}

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: [
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    ...(suite
      ? [
          {
            command:
              'node ../../node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174 --strictPort',
            cwd: join(worshipRepo!, 'apps/web'),
            url: 'http://127.0.0.1:4174',
            reuseExistingServer: false,
            timeout: 30_000,
          },
          {
            command:
              'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000 --strictPort',
            cwd: presenterRepo!,
            env: { NODE_ENV: 'development' },
            url: 'http://127.0.0.1:3000',
            reuseExistingServer: false,
            timeout: 45_000,
          },
        ]
      : []),
    ...(publicPreview
      ? [
          {
            command:
              'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort',
            cwd: publicWebRepo!,
            url: 'http://127.0.0.1:4175',
            reuseExistingServer: false,
            timeout: 30_000,
          },
        ]
      : []),
  ],
})
