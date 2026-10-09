import { Pool } from 'pg'
import { createApiServer } from './api'
import { readConfig } from './config'
import { PostgresServiceRepository } from './PostgresServiceRepository'

const config = readConfig()
const pool = new Pool({ connectionString: config.databaseUrl })
const server = createApiServer(new PostgresServiceRepository(pool), pool)

server.listen(config.port, config.host, () => {
  console.log(
    `LVM Service API listening on http://${config.host}:${config.port}`,
  )
})

async function shutdown(): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await pool.end()
}

process.once('SIGINT', () => {
  void shutdown()
})
process.once('SIGTERM', () => {
  void shutdown()
})
