import { Pool } from 'pg'
import { readConfig } from './config'
import { runMigrations } from './migrate'

const pool = new Pool({ connectionString: readConfig().databaseUrl })
try {
  const applied = await runMigrations(pool)
  console.log(
    applied.length ? `Applied: ${applied.join(', ')}` : 'Database is current',
  )
} finally {
  await pool.end()
}
