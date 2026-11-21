import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { validateSiteDocument } from './site-content.mjs'
import {
  passwordHash,
  passwordMatches,
  newToken,
  tokenHash,
  signDatabaseToken,
} from './security.mjs'

const origin = new URL(process.env.LVM_ORIGIN).origin
const secret = (await readFile('/run/secrets/jwt_secret', 'utf8')).trim()
const pool = new pg.Pool({
  host: 'postgres',
  database: 'lvm_worship',
  user: 'lvm_api',
  password: (await readFile('/run/secrets/api_password', 'utf8')).trim(),
  max: 10,
})
const cookieName = '__Host-lvm_session'
const buckets = new Map()
const dummyHash = await passwordHash(newToken())
const tables = new Set([
  'songs',
  'users',
  'personal_songs',
  'setlists',
  'setlist_songs',
  'user_starred_songs',
  'reflections',
  'sessions',
  'song_suggestions',
  'editor_audit_log',
  'site_documents',
])
const functions = new Set([
  'update_user_role',
  'delete_user',
  'admin_delete_user',
  'review_song_suggestion',
  'list_site_inbox',
  'list_site_documents',
  'save_site_document',
  'my_church_memberships',
  'list_churches',
  'save_church',
  'list_church_memberships',
  'save_church_membership',
  'list_suite_accounts',
])

function reply(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  })
  res.end(JSON.stringify(body))
}
function fail(status, message) {
  return Object.assign(new Error(message), { status })
}
async function body(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_000_000) throw fail(413, 'Request too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
function sessionToken(req) {
  return req.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1)
}
async function currentUser(req) {
  const token = sessionToken(req)
  if (!token || !/^[\w-]{43}$/.test(token)) return null
  const { rows } = await pool.query(
    `SELECT u.id,c.email,u.display_name,u.role,u.preferences FROM public.users u
    JOIN private.credentials c ON c.user_id=u.id JOIN private.auth_sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [tokenHash(token)],
  )
  return rows[0] || null
}
async function establishSession(res, user) {
  const token = newToken()
  await pool.query(
    'INSERT INTO private.auth_sessions(token_hash,user_id) VALUES($1,$2)',
    [tokenHash(token), user.id],
  )
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=604800`,
  )
  return {
    user: {
      id: user.id,
      email: user.email,
      user_metadata: { full_name: user.display_name },
    },
  }
}
function rateLimit(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress)
    .split(',')
    .at(-1)
    .trim()
  const now = Date.now()
  if (buckets.size > 10000)
    for (const [key, bucket] of buckets)
      if (bucket.until < now) buckets.delete(key)
  const bucket = buckets.get(ip)
  if (!bucket || bucket.until < now)
    buckets.set(ip, { count: 1, until: now + 900000 })
  else if (++bucket.count > 30)
    throw fail(429, 'Too many attempts. Try again later.')
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin)
    if (url.pathname === '/api/health' && req.method === 'GET') {
      await pool.query('SELECT 1')
      const check = await fetch('http://rest:3000/songs?select=id&limit=0', {
        signal: AbortSignal.timeout(3000),
      })
      if (!check.ok) throw fail(503, 'Data service unavailable')
      return reply(res, 200, { status: 'ok', database: 'postgresql' })
    }
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    if (write && req.headers.origin !== origin)
      throw fail(403, 'Invalid request origin')
    if (write && !req.headers['content-type']?.startsWith('application/json'))
      throw fail(415, 'JSON required')
    if (url.pathname === '/api/site/submit' && req.method === 'POST') {
      rateLimit(req)
      let input
      try {
        input = JSON.parse((await body(req)).toString())
      } catch {
        throw fail(400, 'Solicitud inválida')
      }
      if (
        !['contacto', 'oracion', 'visita', 'boletin'].includes(input.kind) ||
        !input.fields ||
        typeof input.fields !== 'object' ||
        Array.isArray(input.fields)
      )
        throw fail(400, 'Solicitud inválida')
      const fields = Object.fromEntries(
        Object.entries(input.fields)
          .filter(
            ([key, value]) =>
              ['nombre', 'apellido', 'email', 'telefono', 'mensaje'].includes(
                key,
              ) && typeof value === 'string',
          )
          .map(([key, value]) => [key, value.trim()]),
      )
      if (Object.values(fields).some((value) => value.length > 2000))
        throw fail(400, 'El mensaje es demasiado largo')
      if (input.kind === 'boletin' || input.kind === 'contacto') {
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email || '') ||
          fields.email.length > 254
        )
          throw fail(400, 'Ingresá un correo válido')
      }
      if (input.kind !== 'boletin' && !fields.nombre)
        throw fail(400, 'Ingresá tu nombre')
      if (['contacto', 'oracion'].includes(input.kind) && !fields.mensaje)
        throw fail(400, 'Escribí tu mensaje')
      if (input.kind === 'visita' && !fields.telefono)
        throw fail(400, 'Ingresá un teléfono de contacto')
      await pool.query(
        'INSERT INTO private.site_inbox(kind,payload) VALUES($1,$2)',
        [input.kind, fields],
      )
      return reply(res, 201, { ok: true })
    }
    if (url.pathname.startsWith('/api/auth/')) {
      const action = url.pathname.slice('/api/auth/'.length)
      if (req.method === 'GET' && action === 'session') {
        const user = await currentUser(req)
        const memberships = user
          ? (
              await pool.query(
                'SELECT private.identity_memberships($1) AS memberships',
                [user.id],
              )
            ).rows[0].memberships
          : []
        return reply(res, 200, {
          session: user
            ? {
                user: {
                  id: user.id,
                  email: user.email,
                  role: user.role,
                  memberships,
                  user_metadata: { full_name: user.display_name },
                },
              }
            : null,
        })
      }
      if (req.method !== 'POST') throw fail(405, 'Method not allowed')
      rateLimit(req)
      let input
      try {
        input = JSON.parse((await body(req)).toString() || '{}')
      } catch (error) {
        if (error.status) throw error
        throw fail(400, 'Invalid JSON')
      }
      if (action === 'signup' || action === 'login') {
        const email = String(input.email || '')
          .trim()
          .toLowerCase()
        const password = input.password
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          email.length > 254 ||
          typeof password !== 'string' ||
          password.length > 256
        )
          throw fail(400, 'Invalid credentials')
        if (action === 'signup') {
          if (password.length < 8)
            throw fail(400, 'Password must have at least 8 characters')
          const hash = await passwordHash(password)
          const connection = await pool.connect()
          try {
            await connection.query('BEGIN')
            const { rows } = await connection.query(
              'INSERT INTO public.users(display_name) VALUES($1) RETURNING id,display_name',
              [String(input.options?.data?.full_name || '').slice(0, 120)],
            )
            await connection.query(
              'INSERT INTO private.credentials(user_id,email,password_hash) VALUES($1,$2,$3)',
              [rows[0].id, email, hash],
            )
            await connection.query('COMMIT')
            const session = await establishSession(res, { ...rows[0], email })
            return reply(res, 201, { user: session.user, session })
          } catch (error) {
            await connection.query('ROLLBACK')
            if (error.code === '23505')
              throw fail(409, 'User already registered')
            throw error
          } finally {
            connection.release()
          }
        }
        const { rows } = await pool.query(
          'SELECT u.id,c.email,u.display_name,c.password_hash FROM public.users u JOIN private.credentials c ON c.user_id=u.id WHERE c.email=$1',
          [email],
        )
        const match = await passwordMatches(
          password,
          rows[0]?.password_hash || dummyHash,
        )
        if (!rows[0] || !match) throw fail(401, 'Invalid login credentials')
        const session = await establishSession(res, rows[0])
        return reply(res, 200, { user: session.user, session })
      }
      if (action === 'logout') {
        await pool.query(
          'DELETE FROM private.auth_sessions WHERE token_hash=$1',
          [tokenHash(sessionToken(req) || '')],
        )
        res.setHeader(
          'Set-Cookie',
          `${cookieName}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`,
        )
        return reply(res, 200, {})
      }
      if (action === 'activate') {
        if (
          typeof input.token !== 'string' ||
          !/^[\w-]{43}$/.test(input.token) ||
          typeof input.password !== 'string' ||
          input.password.length < 8 ||
          input.password.length > 256
        )
          throw fail(400, 'Invalid activation request')
        const hash = await passwordHash(input.password)
        const connection = await pool.connect()
        try {
          await connection.query('BEGIN')
          const { rows } = await connection.query(
            'DELETE FROM private.activation_tokens WHERE token_hash=$1 AND expires_at>now() RETURNING user_id',
            [tokenHash(input.token)],
          )
          if (!rows[0]) throw fail(400, 'Activation link is invalid or expired')
          await connection.query(
            'UPDATE private.credentials SET password_hash=$2 WHERE user_id=$1',
            [rows[0].user_id, hash],
          )
          const profile = await connection.query(
            'SELECT u.id,c.email,u.display_name FROM public.users u JOIN private.credentials c ON c.user_id=u.id WHERE u.id=$1',
            [rows[0].user_id],
          )
          await connection.query(
            'DELETE FROM private.auth_sessions WHERE user_id=$1',
            [rows[0].user_id],
          )
          await connection.query('COMMIT')
          const session = await establishSession(res, profile.rows[0])
          return reply(res, 200, { user: session.user, session })
        } catch (error) {
          await connection.query('ROLLBACK')
          throw error
        } finally {
          connection.release()
        }
      }
      if (action === 'password') {
        const user = await currentUser(req)
        if (!user) throw fail(401, 'Not authenticated')
        if (
          typeof input.password !== 'string' ||
          input.password.length < 8 ||
          input.password.length > 256
        )
          throw fail(400, 'Invalid password')
        await pool.query(
          'UPDATE private.credentials SET password_hash=$1 WHERE user_id=$2',
          [await passwordHash(input.password), user.id],
        )
        await pool.query('DELETE FROM private.auth_sessions WHERE user_id=$1', [
          user.id,
        ])
        const session = await establishSession(res, user)
        return reply(res, 200, { user: session.user, session })
      }
      throw fail(
        503,
        'Email recovery and external sign-in are not configured yet',
      )
    }
    if (url.pathname.startsWith('/api/data/')) {
      const path = url.pathname.slice('/api/data/'.length)
      if (!(
        tables.has(path) ||
        (path.startsWith('rpc/') && functions.has(path.slice(4)))
      ))
        throw fail(404, 'Not found')
      if (!['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'].includes(req.method))
        throw fail(405, 'Method not allowed')
      if (
        ['rpc/save_church', 'rpc/save_church_membership'].includes(path) &&
        req.method !== 'POST'
      )
        throw fail(405, 'Method not allowed')
      const user = await currentUser(req)
      const claims = {
        role: user ? 'lvm_user' : 'lvm_anon',
        ...(user ? { sub: user.id } : {}),
      }
      // Anonymous session reads require possession of an exact share code; listing by id cannot reveal codes.
      if (path === 'sessions') {
        const match =
          /^\(code\.eq\.([A-Za-z0-9]{4,16}),chord_code\.eq\.\1\)$/.exec(
            url.searchParams.get('or') || '',
          )
        if (match) claims.join_code = match[1]
      }
      const headers = {
        Authorization: `Bearer ${signDatabaseToken(claims, secret)}`,
      }
      for (const header of [
        'content-type',
        'accept',
        'prefer',
        'range',
        'range-unit',
      ])
        if (req.headers[header]) headers[header] = req.headers[header]
      const payload = write ? await body(req) : undefined
      if (path === 'rpc/save_site_document') {
        if (req.method !== 'POST') throw fail(405, 'Method not allowed')
        if (!user || !['admin', 'owner'].includes(user.role))
          throw fail(403, 'No tenés permisos de publicación')
        try {
          validateSiteDocument(JSON.parse(payload.toString('utf8')))
        } catch (error) {
          throw fail(400, error.message)
        }
      }
      const upstream = await fetch(`http://rest:3000/${path}${url.search}`, {
        method: req.method,
        headers,
        body: payload,
        signal: AbortSignal.timeout(15000),
      })
      const outgoing = { 'Cache-Control': 'no-store' }
      for (const header of [
        'content-type',
        'content-range',
        'preference-applied',
        'range-unit',
      ])
        if (upstream.headers.has(header))
          outgoing[header] = upstream.headers.get(header)
      res.writeHead(upstream.status, outgoing)
      res.end(Buffer.from(await upstream.arrayBuffer()))
      return
    }
    reply(res, 404, { message: 'Not found' })
  } catch (error) {
    if (!error.status)
      console.error('API request failed', {
        code: error.code,
        message: error.message,
      })
    if (!res.headersSent)
      reply(res, error.status || 500, {
        message: error.status ? error.message : 'Service unavailable',
      })
    else res.end()
  }
})
server.requestTimeout = 20000
server.headersTimeout = 10000
server.listen(4318, '0.0.0.0')
const cleanup = setInterval(
  () =>
    pool
      .query('DELETE FROM private.auth_sessions WHERE expires_at<now()')
      .catch(() => {}),
  3600000,
)
cleanup.unref()
process.on('SIGTERM', () => {
  clearInterval(cleanup)
  server.close(() => pool.end())
})
