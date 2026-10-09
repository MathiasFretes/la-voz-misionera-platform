import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'service-postgres.spec.ts',
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium' },
  webServer: [
    {
      command: 'npm run api:dev',
      url: 'http://127.0.0.1:4318/health',
      timeout: 30_000,
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      timeout: 30_000,
    },
  ],
})
