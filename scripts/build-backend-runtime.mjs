import { cp, mkdir } from 'node:fs/promises'
import { build } from 'esbuild'

await build({
  entryPoints: ['backend/src/server.ts', 'backend/src/migrate-cli.ts'],
  outdir: 'dist/backend',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'info',
})

await mkdir('dist/database/migrations', { recursive: true })
await cp('backend/database/migrations', 'dist/database/migrations', {
  recursive: true,
  force: true,
})
