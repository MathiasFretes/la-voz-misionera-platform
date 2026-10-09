import { spawn } from 'node:child_process'
import { createReadStream, createWriteStream } from 'node:fs'
import { link, mkdir, open, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { pipeline } from 'node:stream/promises'
import { URL } from 'node:url'
import { Buffer } from 'node:buffer'

function localDatabase() {
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL is required')
  const url = new URL(raw)
  const name = decodeURIComponent(url.pathname.slice(1))
  const user = decodeURIComponent(url.username)
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.port !== '5433' ||
    name !== 'lvm_service' ||
    !user
  ) {
    throw new Error(
      'DB operations are limited to the local lvm_service database on port 5433',
    )
  }
  return { name, user }
}

function dockerCommand() {
  const container = process.env.LVM_PG_CONTAINER
  return container ? ['exec', '-i', container] : ['compose', 'exec', '-T', 'db']
}

async function runPgTool(tool, args, source, destination) {
  const child = spawn('docker', [...dockerCommand(), tool, ...args], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (part) => {
    stderr = (stderr + part).slice(-16_000)
  })
  const exit = new Promise((accept, reject) => {
    child.once('error', reject)
    child.once('close', (code) => accept(code))
  })
  if (!source) child.stdin.end()
  if (!destination) child.stdout.resume()
  const transfer = source
    ? pipeline(createReadStream(source), child.stdin)
    : pipeline(child.stdout, createWriteStream(destination, { flags: 'wx' }))
  const [streamResult, exitResult] = await Promise.allSettled([transfer, exit])
  if (exitResult.status === 'rejected') throw exitResult.reason
  if (exitResult.value !== 0)
    throw new Error(`${tool} exited with ${exitResult.value}: ${stderr.trim()}`)
  if (streamResult.status === 'rejected') throw streamResult.reason
}

export async function backupDatabase(destination) {
  const { name, user } = localDatabase()
  const target = resolve(destination)
  const partial = `${target}.partial-${process.pid}`
  await mkdir(dirname(target), { recursive: true })
  try {
    await stat(target)
    throw new Error(`Backup already exists: ${target}`)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  try {
    await runPgTool(
      'pg_dump',
      [
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '-U',
        user,
        '-d',
        name,
      ],
      null,
      partial,
    )
    if ((await stat(partial)).size === 0) throw new Error('Backup is empty')
    await link(partial, target)
    await rm(partial)
    return target
  } catch (error) {
    await rm(partial, { force: true })
    throw error
  }
}

export async function restoreDatabase(source, confirmation) {
  const { name, user } = localDatabase()
  if (confirmation !== name)
    throw new Error(`Restore requires --confirm ${name}`)
  const archive = resolve(source)
  const file = await open(archive, 'r')
  try {
    const header = Buffer.alloc(5)
    await file.read(header, 0, 5, 0)
    if (header.toString() !== 'PGDMP')
      throw new Error('Expected a PostgreSQL custom-format backup')
  } finally {
    await file.close()
  }
  await runPgTool(
    'pg_restore',
    [
      '--clean',
      '--if-exists',
      '--single-transaction',
      '--exit-on-error',
      '--no-owner',
      '--no-privileges',
      '-U',
      user,
      '-d',
      name,
    ],
    archive,
    null,
  )
}
