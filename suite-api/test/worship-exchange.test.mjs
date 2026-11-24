import assert from 'node:assert/strict'
import { test } from 'node:test'
import { worshipPath, worshipCommand } from '../worship-exchange.mjs'
import { applyWorshipPlan } from '../worship-contract.mjs'
const church = '00000000-0000-4000-8000-000000000011'
const operation = '00000000-0000-4000-8000-000000000099'
const plan = {
  schemaVersion: '0.1',
  serviceId: 'service-a',
  setlistId: 'set-a',
  name: 'Adoración',
  songs: [
    {
      songId: 'song-a',
      title: 'Fiel',
      key: 'G',
      arrangement: [1],
      sections: [
        {
          kind: 'verse',
          label: 'Verso',
          lines: [{ text: 'Fiel', chords: [{ symbol: 'G', index: 0 }] }],
        },
      ],
    },
  ],
}
const route = { church, id: 'service-a', apply: false }
test('worship exchange binds route, exact input, operation and both revisions', () => {
  assert.deepEqual(
    worshipPath(`/api/churches/${church}/services/service-a/worship`),
    route,
  )
  assert.equal(
    worshipPath(`/api/churches/${church}/services/service-a/worship/apply`)
      .apply,
    true,
  )
  assert.equal(worshipPath('/api/services/service-a/worship'), null)
  assert.throws(
    () => worshipPath(`/api/churches/${church}/services/%ZZ/worship`),
    { status: 400 },
  )
  assert.equal(worshipCommand('GET', route).name, 'get_worship_exchange')
  const command = worshipCommand(
    'PUT',
    route,
    { plan, revision: 0, serviceRevision: 2 },
    operation,
  )
  assert.equal(command.data.p_service_revision, 2)
  assert.equal(command.data.p_expected_revision, 0)
  assert.equal(command.data.p_operation_id, operation)
  for (const input of [
    { plan, revision: 0, serviceRevision: 0 },
    { plan, revision: 0, serviceRevision: 1, actor: 'other' },
    { plan: { ...plan, serviceId: 'other' }, revision: 0, serviceRevision: 1 },
  ]) {
    assert.throws(() => worshipCommand('PUT', route, input, operation), {
      status: 400,
    })
  }
  assert.throws(
    () =>
      worshipCommand('PUT', route, { plan, revision: 0, serviceRevision: 1 }),
    { status: 400 },
  )
  assert.throws(() => worshipCommand('GET', { ...route, apply: true }), {
    status: 405,
  })
  assert.equal(
    worshipCommand(
      'POST',
      { ...route, apply: true },
      { revision: 1, serviceRevision: 2 },
      operation,
    ).name,
    'apply_worship_plan',
  )
})
test('musical submission validates chords, section occurrences and rejects non-musical fields', () => {
  const submit = (value) =>
    worshipCommand(
      'PUT',
      route,
      { plan: value, revision: 0, serviceRevision: 1 },
      operation,
    )
  assert.throws(() => submit({ ...plan, sermon: {} }), { status: 400 })
  assert.throws(() => submit({ ...plan, songs: [] }), { status: 400 })
  assert.throws(
    () =>
      submit({ ...plan, songs: [{ ...plan.songs[0], arrangement: [1, 1] }] }),
    { status: 400 },
  )
  assert.throws(
    () =>
      submit({
        ...plan,
        songs: [
          {
            ...plan.songs[0],
            sections: [
              {
                kind: 'verse',
                label: 'V',
                lines: [{ text: '🎵', chords: [{ symbol: 'G', index: 1 }] }],
              },
            ],
          },
        ],
      }),
    { status: 400 },
  )
})
test('the existing merge contract retains manual items and replaces only the managed musical block', () => {
  const manual = {
    id: 'welcome',
    kind: 'ANNOUNCEMENT',
    announcement: { title: 'Bienvenida', body: 'Bienvenidos' },
  }
  const service = {
    schemaVersion: '0.1',
    id: 'service-a',
    title: 'Culto',
    startsAt: '2026-12-01T12:00:00Z',
    setlist: { id: 'set-a', name: 'Adoración' },
    items: [
      manual,
      { id: 'lvm-worship:service-a:old', kind: 'SONG', song: {} },
    ],
  }
  const merged = applyWorshipPlan(service, plan, 'welcome')
  assert.deepEqual(
    merged.items.map((item) => item.id),
    ['welcome', 'lvm-worship:service-a:1'],
  )
  assert.deepEqual(merged.items[0], manual)
  assert.throws(() => applyWorshipPlan(service, plan, 'missing'), /inserción/)
})
