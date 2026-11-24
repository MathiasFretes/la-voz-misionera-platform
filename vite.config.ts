import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.LVM_SERVICE_ASSET_BASE || '/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:4318' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:4318' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
