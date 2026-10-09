import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { Pool } from 'pg'
import { backupDatabase, restoreDatabase } from './db-operations.mjs'

const folder = await mkdtemp(join(tmpdir(), 'lvm-db-ops-'))
const archive = join(folder, 'service.dump')
const id = `m8e-backup-${randomUUID()}`
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  await pool.query(
    `INSERT INTO services
      (id, schema_version, title, starts_at, starts_at_text, setlist_id,
       setlist_name, venue)
     VALUES ($1, '0.1', 'Backup check', now(), $2, $3, 'Backup check', '')`,
    [id, new Date().toISOString(), `setlist-${id}`],
  )
  await backupDatabase(archive)
  await pool.query('DELETE FROM services WHERE id = $1', [id])
  if (
    (await pool.query('SELECT id FROM services WHERE id = $1', [id])).rowCount
  )
    throw new Error('Control record was not deleted before restore')
  try {
    await restoreDatabase(archive, 'wrong_database')
    throw new Error('Restore confirmation guard did not reject')
  } catch (error) {
    if (!/requires --confirm lvm_service/.test(error.message)) throw error
  }
  await restoreDatabase(archive, 'lvm_service')
  const restored = await pool.query(
    'SELECT title, revision FROM services WHERE id = $1',
    [id],
  )
  if (
    restored.rows[0]?.title !== 'Backup check' ||
    restored.rows[0]?.revision !== 1
  ) {
    throw new Error('Control record was not restored correctly')
  }
  console.log('PostgreSQL backup/restore preserved the control record')
} finally {
  try {
    await pool.query('DELETE FROM services WHERE id = $1', [id])
  } finally {
    await pool.end()
    await rm(folder, { recursive: true, force: true })
  }
}
