import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

export async function runMigrations(pool: Pool): Promise<string[]> {
  const directory = fileURLToPath(
    new URL('../database/migrations/', import.meta.url),
  )
  const files = (await readdir(directory))
    .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/.test(file))
    .sort()
  if (!files.length) throw new Error('No database migrations found')
  const client = await pool.connect()
  const applied: string[] = []
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(80901735)')
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`)
    for (const file of files) {
      const sql = await readFile(
        fileURLToPath(
          new URL(`../database/migrations/${file}`, import.meta.url),
        ),
        'utf8',
      )
      const checksum = createHash('sha256').update(sql).digest('hex')
      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE id = $1',
        [file],
      )
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error(`Migration ${file} changed after application`)
        continue
      }
      await client.query(sql)
      await client.query(
        'INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)',
        [file, checksum],
      )
      applied.push(file)
    }
    await client.query('COMMIT')
    return applied
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
