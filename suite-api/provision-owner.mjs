import { readFile, writeFile } from 'node:fs/promises'
import pg from 'pg'
import { newToken, tokenHash } from './security.mjs'

const email = process.argv[2]?.trim().toLowerCase()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error('Usage: provision-owner.mjs email')
const pool = new pg.Pool({
  host: 'postgres',
  database: 'lvm_worship',
  user: 'lvm_owner',
  password: (await readFile('/run/secrets/postgres_password', 'utf8')).trim(),
})
const connection = await pool.connect()
try {
  await connection.query('BEGIN')
  const owners = await connection.query(
    "SELECT c.email FROM public.users u JOIN private.credentials c ON c.user_id=u.id WHERE u.role='owner' FOR UPDATE",
  )
  if (owners.rows.some((row) => row.email !== email))
    throw new Error('A different owner already exists')
  const existing = await connection.query(
    'SELECT user_id AS id FROM private.credentials WHERE email=$1',
    [email],
  )
  const { rows } = existing.rows.length
    ? await connection.query(
        "UPDATE public.users SET role='owner' WHERE id=$1 RETURNING id",
        [existing.rows[0].id],
      )
    : await connection.query(
        "INSERT INTO public.users(display_name,role) VALUES('Mathias','owner') RETURNING id",
      )
  await connection.query(
    'INSERT INTO private.credentials(user_id,email) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING',
    [rows[0].id, email],
  )
  await connection.query(
    'DELETE FROM private.activation_tokens WHERE user_id=$1',
    [rows[0].id],
  )
  const token = newToken()
  await connection.query(
    'INSERT INTO private.activation_tokens(token_hash,user_id) VALUES($1,$2)',
    [tokenHash(token), rows[0].id],
  )
  await connection.query('COMMIT')
  await writeFile(
    '/activation/owner-activation-url',
    `${process.env.LVM_ORIGIN}/activate#${token}\n`,
    { mode: 0o600 },
  )
  console.log(
    'Owner reserved; one-time activation URL written to protected file (valid 24 hours).',
  )
} catch (error) {
  await connection.query('ROLLBACK')
  throw error
} finally {
  connection.release()
  await pool.end()
}
