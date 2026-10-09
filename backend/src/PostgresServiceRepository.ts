import type { Pool } from 'pg'
import type { ServiceItem } from '../../src/contracts/service'
import type { ServiceRecord } from '../../src/domain/service/service'
import { validateServiceRecord } from './validateRecord'

type Row = {
  id: string
  revision: number
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
        revision: row.revision,
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
  SELECT s.id, s.revision, s.schema_version, s.title, s.starts_at_text,
    s.setlist_id, s.setlist_name, s.venue, s.worship_after_item_id,
    i.item_id, i.payload
  FROM services s LEFT JOIN service_items i ON i.service_id = s.id
`

export class RevisionConflictError extends Error {}

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
      const values = [
        record.id,
        record.service.schemaVersion,
        record.service.title,
        record.service.startsAt,
        record.service.startsAt,
        record.service.setlist.id,
        record.service.setlist.name,
        record.venue,
        record.worshipAfterItemId ?? null,
      ]
      const result = await client.query<{ revision: number }>(
        record.revision === undefined
          ? `INSERT INTO services (id, schema_version, title, starts_at, starts_at_text,
               setlist_id, setlist_name, venue, worship_after_item_id)
             VALUES ($1, $2, $3, $4::timestamptz, $5::text, $6, $7, $8, $9)
             ON CONFLICT (id) DO NOTHING RETURNING revision`
          : `UPDATE services SET schema_version = $2, title = $3,
               starts_at = $4::timestamptz, starts_at_text = $5::text,
               setlist_id = $6, setlist_name = $7, venue = $8,
               worship_after_item_id = $9, updated_at = now(),
               revision = revision + 1
             WHERE id = $1 AND revision = $10 RETURNING revision`,
        [
          ...values,
          ...(record.revision === undefined ? [] : [record.revision]),
        ],
      )
      if (!result.rows[0])
        throw new RevisionConflictError('Service changed in another session')
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
      return { ...record, revision: result.rows[0].revision }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async remove(id: string, expectedRevision?: number): Promise<boolean> {
    const result = await this.pool.query(
      expectedRevision === undefined
        ? 'DELETE FROM services WHERE id = $1'
        : 'DELETE FROM services WHERE id = $1 AND revision = $2',
      expectedRevision === undefined ? [id] : [id, expectedRevision],
    )
    if (
      expectedRevision !== undefined &&
      !result.rowCount &&
      (await this.get(id))
    )
      throw new RevisionConflictError('Service changed in another session')
    return (result.rowCount ?? 0) > 0
  }
}
