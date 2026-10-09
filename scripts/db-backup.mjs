import { backupDatabase } from './db-operations.mjs'
import process from 'node:process'
import console from 'node:console'

const path = process.argv[2]
if (!path) {
  console.error('Usage: npm run db:backup -- .backups/lvm-service.dump')
  process.exit(2)
}
try {
  console.log(`Backup saved: ${await backupDatabase(path)}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
