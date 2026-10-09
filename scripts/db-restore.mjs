import { restoreDatabase } from './db-operations.mjs'
import process from 'node:process'
import console from 'node:console'

const [path, flag, name] = process.argv.slice(2)
if (!path || flag !== '--confirm' || !name) {
  console.error(
    'Usage: npm run db:restore -- backup.dump --confirm lvm_service',
  )
  process.exit(2)
}
try {
  await restoreDatabase(path, name)
  console.log(`Restored ${name} from ${path}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
