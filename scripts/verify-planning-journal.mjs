import assert from 'node:assert/strict'
import { readFile, mkdtemp, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { chromium } from '@playwright/test'

const temporary = process.env.LVM_JOURNAL_BUNDLE
  ? null
  : await mkdtemp(join(tmpdir(), 'lvm-planning-journal-'))
const bundlePath =
  process.env.LVM_JOURNAL_BUNDLE || join(temporary, 'journal.mjs')
if (temporary)
  await build({
    entryPoints: ['src/repositories/api/PlanningJournal.ts'],
    bundle: true,
    format: 'esm',
    outfile: bundlePath,
  })
const bundle = await readFile(bundlePath, 'utf8')
const server = createServer((req, res) => {
  res.setHeader(
    'Content-Type',
    req.url === '/journal.mjs' ? 'text/javascript' : 'text/html',
  )
  res.end(
    req.url === '/journal.mjs'
      ? bundle
      : '<!doctype html><title>Planning journal QA</title>',
  )
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const a = await context.newPage()
const b = await context.newPage()
const record = (id, title) => ({
  id,
  venue: 'Central',
  service: {
    schemaVersion: '0.1',
    id,
    title,
    startsAt: '2026-12-01T12:00:00Z',
    setlist: { id: `set-${id}`, name: title },
    items: [],
  },
})
async function open(page, client) {
  await page.goto(origin)
  await page.evaluate(async (clientId) => {
    const { PlanningJournal } = await import('/journal.mjs')
    globalThis.journal = new PlanningJournal('account-a', 'church-a', clientId)
  }, client)
}
const snapshot = (page) => page.evaluate(() => globalThis.journal.snapshot())
const mutate = (page, id, generation, value, deleted) =>
  page.evaluate(
    ([id, generation, value, deleted]) =>
      globalThis.journal.mutate(id, generation, value, deleted),
    [id, generation, value, deleted],
  )
const next = (page) => page.evaluate(() => globalThis.journal.next())
const ack = (page, id, operationId, value) =>
  page.evaluate(
    ([id, operationId, value]) =>
      globalThis.journal.acknowledge(id, operationId, value),
    [id, operationId, value],
  )
try {
  await Promise.all([open(a, 'tab-a'), open(b, 'tab-b')])
  await Promise.all(
    Array.from({ length: 40 }, (_, index) =>
      mutate(
        index % 2 ? a : b,
        `parallel-${index}`,
        0,
        record(`parallel-${index}`, `Plan ${index}`),
      ),
    ),
  )
  assert.equal(
    (await snapshot(a)).entries.length,
    40,
    'Parallel tabs must retain every distinct draft',
  )
  await a.evaluate(async () => {
    const { PlanningJournal } = await import('/journal.mjs')
    const other = new PlanningJournal('account-b', 'church-a', 'other')
    const church = new PlanningJournal('account-a', 'church-b', 'other')
    if (
      (await other.snapshot()).entries.length ||
      (await church.snapshot()).entries.length
    )
      throw new Error('Scope leak')
    await other.close()
    await church.close()
  })
  // Use a separate church so unrelated pending plans cannot affect operation selection.
  for (const page of [a, b])
    await page.evaluate(async () => {
      await globalThis.journal.close()
      const { PlanningJournal } = await import('/journal.mjs')
      globalThis.journal = new PlanningJournal(
        'account-a',
        'church-flow',
        globalThis.crypto.randomUUID(),
      )
    })
  const first = record('flow', 'Versión enviada')
  await mutate(a, 'flow', 0, first)
  const sent = await next(a)
  assert.ok(sent.operation.id)
  const latest = record('flow', 'Título más reciente')
  await mutate(a, 'flow', 1, latest)
  await ack(b, 'flow', sent.operation.id, { ...first, revision: 1 })
  let state = (await snapshot(a)).entries.find((entry) => entry.id === 'flow')
  assert.equal(
    state.record.service.title,
    latest.service.title,
    'Old response must not replace a newer edit',
  )
  assert.equal(state.revision, 1)
  const second = await next(b)
  assert.notEqual(second.operation.id, sent.operation.id)
  assert.equal(second.operation.expectedRevision, 1)
  await ack(a, 'flow', second.operation.id, { ...latest, revision: 2 })
  await ack(b, 'flow', sent.operation.id, { ...first, revision: 1 })
  assert.equal(
    (await snapshot(a)).entries[0].revision,
    2,
    'Duplicate delayed acknowledgement must not rewind revision',
  )
  // Concurrent edits of the same generation must preserve a conflict copy.
  const edits = await Promise.all([
    mutate(a, 'flow', 2, record('flow', 'Edición pestaña A')),
    mutate(b, 'flow', 2, record('flow', 'Edición pestaña B')),
  ])
  assert.equal(edits.filter((result) => result.conflict).length, 1)
  const conflict = (await snapshot(a)).conflicts[0]
  assert.ok(conflict.record.service.title.startsWith('Edición pestaña'))
  await a.evaluate(
    ([key, remote]) => globalThis.journal.resolve(key, 'local', remote, 3),
    [conflict.key, { ...latest, revision: 4 }],
  )
  const retry = await next(a)
  assert.equal(retry.operation.expectedRevision, 4)
  assert.equal(
    retry.operation.record.service.title,
    conflict.record.service.title,
  )
  // The same persisted operation survives closing and reopening the browser page.
  await a.evaluate(() => globalThis.journal.close())
  await a.reload()
  await a.evaluate(async () => {
    const { PlanningJournal } = await import('/journal.mjs')
    globalThis.journal = new PlanningJournal(
      'account-a',
      'church-flow',
      'reopened',
    )
  })
  assert.equal((await next(a)).operation.id, retry.operation.id)
  await a.evaluate(
    ([id, operationId]) => globalThis.journal.rejectRevision(id, operationId),
    ['flow', retry.operation.id],
  )
  assert.equal(
    await next(a),
    null,
    'A revision conflict requires explicit resolution',
  )
  state = await snapshot(a)
  assert.equal(
    state.entries[0].record.service.title,
    conflict.record.service.title,
  )
  assert.equal(state.conflicts.length, 1)
  // Deleting before the first request cancels the pending creation entirely.
  const unsent = record('unsent', 'No publicar')
  await mutate(b, 'unsent', 0, unsent)
  await mutate(b, 'unsent', 1, null, unsent)
  assert.equal(await next(b), null)
  const unsentState = (await snapshot(b)).entries.find(
    (entry) => entry.id === 'unsent',
  )
  assert.equal(unsentState.record, null)
  assert.equal(unsentState.pending, null)
  // Deleting while creation is in flight waits for its confirmed server revision.
  const transient = record('transient', 'Borrar al confirmar')
  await mutate(b, 'transient', 0, transient)
  const creating = await next(b)
  await mutate(a, 'transient', 1, null, transient)
  await ack(b, 'transient', creating.operation.id, {
    ...transient,
    revision: 1,
  })
  const deleting = await next(a)
  assert.equal(deleting.entry.id, 'transient')
  assert.equal(deleting.operation.expectedRevision, 1)
  assert.equal(deleting.operation.record, null)
  await ack(a, 'transient', deleting.operation.id, {
    revision: 2,
    deleted: true,
  })
  assert.equal(await next(a), null)
  console.log(
    'PASS: real IndexedDB in two browser tabs; 40 concurrent drafts, account/church isolation, generation conflict preservation, late/duplicate replies, explicit resolution, durable operation ID after reload and deletion before/during creation',
  )
} finally {
  await browser.close()
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  if (temporary) {
    await unlink(bundlePath)
    await rmdir(temporary)
  }
}
