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

async function snapshot() {
  const [services, items, migrations] = await Promise.all([
    pool.query('SELECT * FROM services ORDER BY id'),
    pool.query('SELECT * FROM service_items ORDER BY service_id, position'),
    pool.query('SELECT * FROM schema_migrations ORDER BY id'),
  ])
  return JSON.stringify({
    services: services.rows,
    items: items.rows,
    migrations: migrations.rows,
  })
}

try {
  await pool.query(
    `INSERT INTO services
      (id, schema_version, title, starts_at, starts_at_text, setlist_id,
       setlist_name, venue)
     VALUES ($1, '0.1', 'Backup check', now(), $2, $3, 'Backup check', '')`,
    [id, new Date().toISOString(), `setlist-${id}`],
  )
  await pool.query(
    `INSERT INTO service_items (service_id, item_id, position, kind, payload)
     VALUES ($1, $2, 0, 'ANNOUNCEMENT', $3::jsonb)`,
    [
      id,
      `${id}-welcome`,
      JSON.stringify({
        id: `${id}-welcome`,
        kind: 'ANNOUNCEMENT',
        announcement: { title: 'Bienvenida', body: 'Copia íntegra' },
      }),
    ],
  )
  const before = await snapshot()
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
  if ((await snapshot()) !== before)
    throw new Error('Restored database differs from the pre-backup snapshot')
  console.log(
    'PostgreSQL backup/restore preserved services, ordered items and migration ledger',
  )
} finally {
  try {
    await pool.query('DELETE FROM services WHERE id = $1', [id])
  } finally {
    await pool.end()
    await rm(folder, { recursive: true, force: true })
  }
}
