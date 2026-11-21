import test from 'node:test'
import assert from 'node:assert/strict'
import { contentCollections, validateSiteDocument } from '../site-content.mjs'

const input = (data = {}, action = 'save') => ({
  p_collection: 'eventos',
  p_id: 'event-1',
  p_expected_revision: 0,
  p_data: data,
  p_action: action,
})
test('drafts may be incomplete; publication requires the actual public fields', () => {
  assert.doesNotThrow(() => validateSiteDocument(input({ name: 'Encuentro' })))
  assert.throws(
    () => validateSiteDocument(input({ name: 'Encuentro' }, 'publish')),
    /fecha/,
  )
  assert.doesNotThrow(() =>
    validateSiteDocument(
      input(
        {
          name: 'Encuentro',
          date: '2026-12-01',
          time: '19:00',
          day: 'Sede central',
        },
        'publish',
      ),
    ),
  )
})
test('content validation rejects unsafe links, bad dates and unsupported values', () => {
  const sermon = { ...input(), p_collection: 'predicas' }
  for (const videoUrl of [
    'javascript:alert(1)',
    'data:text/html,hi',
    'https://user:secret@example.com',
  ])
    assert.throws(() =>
      validateSiteDocument({ ...sermon, p_data: { videoUrl } }),
    )
  assert.throws(() => validateSiteDocument(input({ date: '2026-02-30' })))
  assert.throws(() => validateSiteDocument(input({ time: '25:40' })))
  assert.throws(() =>
    validateSiteDocument(input({ color: 'url(javascript:1)' })),
  )
  assert.throws(() => validateSiteDocument(input({ unknown: 'hidden' })))
  assert.throws(() =>
    validateSiteDocument({ ...input(), p_expected_revision: -1 }),
  )
})
test('every editable collection has distinct fields and a public destination', () => {
  assert.equal(contentCollections.length, 9)
  for (const collection of contentCollections) {
    assert.equal(
      new Set(collection.fields.map((field) => field.key)).size,
      collection.fields.length,
    )
    assert.ok(
      collection.fields.some((field) => field.key === collection.titleField),
    )
    assert.ok(collection.publicPath.startsWith('/'))
  }
})
test('editorial pages use stable IDs and cannot activate a live broadcast without a link', () => {
  const editorial = { ...input(), p_collection: 'contenido', p_id: 'home' }
  assert.doesNotThrow(() =>
    validateSiteDocument({
      ...editorial,
      p_data: { heroTitle: 'Bienvenidos' },
    }),
  )
  assert.throws(
    () => validateSiteDocument({ ...editorial, p_id: 'random-copy' }),
    /Contenido no reconocido/,
  )
  assert.throws(
    () =>
      validateSiteDocument({
        ...editorial,
        p_action: 'publish',
        p_data: {
          heroTitle: 'Bienvenidos',
          heroSubtitle: 'Una comunidad',
          isLive: true,
          liveVideoUrl: '',
        },
      }),
    /enlace/,
  )
  assert.throws(
    () =>
      validateSiteDocument({
        ...editorial,
        p_id: 'general',
        p_action: 'publish',
        p_data: { devocionalTitulo: 'Lectura' },
      }),
    /fecha/,
  )
})
