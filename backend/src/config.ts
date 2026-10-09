export type BackendConfig = {
  databaseUrl: string
  port: number
}

export function readConfig(
  env: NodeJS.ProcessEnv = process.env,
): BackendConfig {
  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')
  const parsed = new URL(databaseUrl)
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://')
  }
  const port = Number(env.LVM_API_PORT ?? '4318')
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('LVM_API_PORT must be a TCP port from 1 to 65535')
  }
  return { databaseUrl, port }
}
