import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import type { Pool } from 'pg'
import {
  PostgresServiceRepository,
  RevisionConflictError,
} from './PostgresServiceRepository'
import { validateServiceRecord } from './validateRecord'

class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (
    !request.headers['content-type']
      ?.toLowerCase()
      .startsWith('application/json')
  ) {
    throw new HttpError(415, 'Content-Type must be application/json')
  }
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > 2_000_000) throw new HttpError(413, 'JSON body exceeds 2 MB')
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new HttpError(400, 'Invalid JSON body')
  }
}

export function createApiServer(
  repository: PostgresServiceRepository,
  pool: Pool,
) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (request.method === 'GET' && url.pathname === '/health') {
        await pool.query('SELECT 1')
        json(response, 200, { status: 'ok' })
        return
      }
      if (url.pathname === '/api/services') {
        if (request.method === 'GET') {
          json(response, 200, await repository.list())
          return
        }
        if (request.method === 'POST') {
          const body = validateServiceRecord(await readJson(request))
          if (body.revision !== undefined)
            throw new HttpError(400, 'New service must not have a revision')
          json(response, 201, await repository.save(body))
          return
        }
      }
      const match = /^\/api\/services\/([^/]+)$/.exec(url.pathname)
      if (match) {
        const id = decodeURIComponent(match[1])
        if (request.method === 'GET') {
          const record = await repository.get(id)
          json(
            response,
            record ? 200 : 404,
            record ?? { error: 'Service not found' },
          )
          return
        }
        if (request.method === 'PUT') {
          const body = await readJson(request)
          if (
            typeof body !== 'object' ||
            body === null ||
            !('id' in body) ||
            body.id !== id
          ) {
            throw new HttpError(400, 'URL id must match record.id')
          }
          json(response, 200, await repository.save(body))
          return
        }
        if (request.method === 'DELETE') {
          const matchRevision = request.headers['if-match']
          if (
            matchRevision !== undefined &&
            (typeof matchRevision !== 'string' ||
              !/^[1-9]\d*$/.test(matchRevision) ||
              !Number.isSafeInteger(Number(matchRevision)))
          ) {
            throw new HttpError(400, 'If-Match must be a positive revision')
          }
          const removed = await repository.remove(
            id,
            matchRevision === undefined ? undefined : Number(matchRevision),
          )
          json(
            response,
            removed ? 200 : 404,
            removed ? { deleted: true } : { error: 'Service not found' },
          )
          return
        }
      }
      json(response, 404, { error: 'Route not found' })
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        json(response, 409, { error: error.message })
      } else if (error instanceof HttpError) {
        json(response, error.status, { error: error.message })
      } else if (
        error instanceof Error &&
        /^(record|service)[.:]/.test(error.message)
      ) {
        json(response, 400, { error: error.message })
      } else {
        console.error('API request failed', error)
        json(response, 500, { error: 'Internal server error' })
      }
    }
  })
}
