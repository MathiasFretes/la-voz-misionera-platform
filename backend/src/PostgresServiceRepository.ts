import type { Pool } from 'pg'
import type { ServiceItem } from '../../src/contracts/service'
import type { ServiceRecord } from '../../src/domain/service/service'
import { validateServiceRecord } from './validateRecord'

type Row = {
  id: string
  schema_version: '0.1'
  title: string
  starts_at_text: string
  setlist_id: string
  setlist_name: string
  venue: string
  worship_after_item_id: string | null
  item_id: string | null
  payload: ServiceItem | null
}

function recordsFromRows(rows: Row[]): ServiceRecord[] {
  const records = new Map<string, ServiceRecord>()
  for (const row of rows) {
    let record = records.get(row.id)
    if (!record) {
      record = {
        id: row.id,
        venue: row.venue,
        service: {
          schemaVersion: row.schema_version,
          id: row.id,
          title: row.title,
          startsAt: row.starts_at_text,
          setlist: { id: row.setlist_id, name: row.setlist_name },
          items: [],
        },
        ...(row.worship_after_item_id
          ? { worshipAfterItemId: row.worship_after_item_id }
          : {}),
      }
      records.set(row.id, record)
    }
    if (row.item_id && row.payload) record.service.items.push(row.payload)
  }
  return [...records.values()]
}

const SELECT_RECORDS = `
  SELECT s.id, s.schema_version, s.title, s.starts_at_text,
    s.setlist_id, s.setlist_name, s.venue, s.worship_after_item_id,
    i.item_id, i.payload
  FROM services s LEFT JOIN service_items i ON i.service_id = s.id
`

export class PostgresServiceRepository {
  private readonly pool: Pool

  constructor(pool: Pool) {
    this.pool = pool
  }

  async list(): Promise<ServiceRecord[]> {
    const result = await this.pool.query<Row>(
      `${SELECT_RECORDS} ORDER BY s.starts_at DESC, s.id, i.position`,
    )
    return recordsFromRows(result.rows)
  }

  async get(id: string): Promise<ServiceRecord | null> {
    const result = await this.pool.query<Row>(
      `${SELECT_RECORDS} WHERE s.id = $1 ORDER BY i.position`,
      [id],
    )
    return recordsFromRows(result.rows)[0] ?? null
  }

  async save(input: unknown): Promise<ServiceRecord> {
    const record = validateServiceRecord(input)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO services (id, schema_version, title, starts_at, starts_at_text,
          setlist_id, setlist_name, venue, worship_after_item_id)
         VALUES ($1, $2, $3, $4::timestamptz, $5::text, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           schema_version = EXCLUDED.schema_version,
           title = EXCLUDED.title,
           starts_at = EXCLUDED.starts_at,
           starts_at_text = EXCLUDED.starts_at_text,
           setlist_id = EXCLUDED.setlist_id,
           setlist_name = EXCLUDED.setlist_name,
           venue = EXCLUDED.venue,
           worship_after_item_id = EXCLUDED.worship_after_item_id,
           updated_at = now()`,
        [
          record.id,
          record.service.schemaVersion,
          record.service.title,
          record.service.startsAt,
          record.service.startsAt,
          record.service.setlist.id,
          record.service.setlist.name,
          record.venue,
          record.worshipAfterItemId ?? null,
        ],
      )
      await client.query('DELETE FROM service_items WHERE service_id = $1', [
        record.id,
      ])
      for (const [position, item] of record.service.items.entries()) {
        await client.query(
          `INSERT INTO service_items (service_id, item_id, position, kind, payload)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [record.id, item.id, position, item.kind, JSON.stringify(item)],
        )
      }
      await client.query('COMMIT')
      return record
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM services WHERE id = $1', [
      id,
    ])
    return (result.rowCount ?? 0) > 0
  }
}
