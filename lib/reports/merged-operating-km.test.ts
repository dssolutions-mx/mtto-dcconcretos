import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveTrustedOperatingKilometers } from './diesel-efficiency-hours-policy'
import { buildMergedKmReadingEventsForAsset, mergedKmFromEvents } from './merged-operating-km'
import { mexicoCityMonthWindowFromYm } from './mexico-city-report-window'

test('resolveTrustedOperatingKilometers prefers merged when positive', () => {
  const r = resolveTrustedOperatingKilometers(500, 800)
  assert.equal(r.trusted, 500)
  assert.equal(r.merged, 500)
  assert.equal(r.sumRaw, 800)
  assert.equal(r.mergeFork, true)
})

test('resolveTrustedOperatingKilometers falls back to sum when merged is zero', () => {
  const r = resolveTrustedOperatingKilometers(0, 1200)
  assert.equal(r.trusted, 1200)
  assert.equal(r.mergeFork, false)
})

test('mergeFork km uses same relative epsilon as hours policy', () => {
  const m = 100
  const s = 140
  const r = resolveTrustedOperatingKilometers(m, s)
  assert.equal(r.mergeFork, true)
})

test('mergedKmFromEvents returns prorated km inside Mexico_City month window', () => {
  const w = mexicoCityMonthWindowFromYm('2026-03')
  const startMs = w.startInclusiveMs
  const endMs = w.endExclusiveMs
  const mid = startMs + (endMs - startMs) / 2
  const events = [
    { ts: startMs + 86400000, val: 10_000 },
    { ts: mid, val: 11_000 },
    { ts: endMs - 86400000, val: 12_000 },
  ]
  const km = mergedKmFromEvents(events, startMs, endMs)
  assert.ok(km > 0)
  assert.ok(km <= 3000)
})

test('buildMergedKmReadingEventsForAsset keeps checklist km inside diesel band', () => {
  const dieselTxs = [
    { transaction_date: '2026-03-05T12:00:00.000Z', kilometer_reading: 50_000 },
    { transaction_date: '2026-03-20T12:00:00.000Z', kilometer_reading: 50_500 },
  ]
  const march = mexicoCityMonthWindowFromYm('2026-03')
  const chkInBand = { ts: march.startInclusiveMs + 10 * 86400000, val: 50_200 }
  const chkOutOfBand = { ts: march.startInclusiveMs + 11 * 86400000, val: 80_000 }
  const merged = buildMergedKmReadingEventsForAsset({
    dieselTxs,
    checklistReadingEvents: [chkInBand, chkOutOfBand],
  })
  const vals = merged.map((e) => e.val).sort((a, b) => a - b)
  assert.ok(vals.includes(50_200))
  assert.ok(!vals.includes(80_000))
})
