import { describe, expect, it } from 'vitest'
import { readConfig } from './config'

const databaseUrl = 'postgres://lvm:secret@localhost:5432/lvm_service'

describe('API bind configuration', () => {
  it('stays on loopback by default', () => {
    expect(readConfig({ DATABASE_URL: databaseUrl })).toEqual({
      databaseUrl,
      host: '127.0.0.1',
      port: 4318,
    })
  })

  it('allows an explicit container bind', () => {
    expect(
      readConfig({ DATABASE_URL: databaseUrl, LVM_API_HOST: '0.0.0.0' }).host,
    ).toBe('0.0.0.0')
  })

  it('rejects arbitrary bind addresses', () => {
    expect(() =>
      readConfig({ DATABASE_URL: databaseUrl, LVM_API_HOST: '192.0.2.5' }),
    ).toThrow('LVM_API_HOST')
  })
})
