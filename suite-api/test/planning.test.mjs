import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planningPath, planningCommand } from '../planning.mjs'

const church = '96a40990-fdd6-43e2-aa17-b30420fc5452'
const record = {
  id: 'service-a',
  venue: 'Central',
  service: {
    schemaVersion: '0.1',
    id: 'service-a',
    title: 'Domingo',
    startsAt: '2026-12-01T12:00:00Z',
    setlist: { id: 'set-a', name: 'Domingo' },
    items: [],
  },
}
test('planning routes bind the church and record ID from the URL', () => {
  assert.deepEqual(planningPath(`/api/churches/${church}/services`), {
    church,
    id: null,
  })
  assert.equal(planningPath('/api/services'), null)
  assert.equal(
    planningPath('/api/churches/------------------------------------/services'),
    null,
  )
  assert.throws(() => planningPath(`/api/churches/${church}/services/%ZZ`), {
    status: 400,
  })
  assert.throws(() => planningCommand('PUT', { church, id: 'other' }, record), {
    status: 400,
  })
})
test('planning preserves Service 0.1 validation and empty drafts without weakening the export contract', () => {
  const route = { church, id: record.id }
  const command = planningCommand('PUT', route, record)
  assert.equal(command.data.p_expected_revision, 0)
  assert.equal(command.data.p_church_id, church)
  assert.throws(
    () => planningCommand('PUT', route, { ...record, extra: true }),
    { status: 400 },
  )
  assert.throws(
    () =>
      planningCommand('PUT', route, {
        ...record,
        service: { ...record.service, items: [{ id: 'bad', kind: 'made-up' }] },
      }),
    { status: 400 },
  )
  assert.throws(
    () =>
      planningCommand('PUT', route, {
        ...record,
        service: { ...record.service, startsAt: 'bad' },
      }),
    { status: 400 },
  )
})
test('planning writes require a matching revision and never allow GET mutations', () => {
  const route = { church, id: record.id }
  assert.throws(() => planningCommand('GET', route), { status: 405 })
  assert.throws(() => planningCommand('DELETE', route, {}), { status: 400 })
  assert.throws(() => planningCommand('DELETE', route, { revision: 1.1 }), {
    status: 400,
  })
  assert.equal(
    planningCommand('DELETE', route, { revision: 4 }).data.p_expected_revision,
    4,
  )
  assert.equal(
    planningCommand('PUT', route, { ...record, revision: 4 }).data
      .p_expected_revision,
    4,
  )
  assert.equal(
    planningCommand('GET', { church, id: null }).name,
    'list_service_plans',
  )
})
