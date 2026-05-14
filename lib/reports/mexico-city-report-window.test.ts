import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatMexicoCityDateOnly,
  mexicoCityMonthWindowFromYm,
} from './mexico-city-report-window'

test('Mexico City March 2026 window uses local month boundaries (UTC−6)', () => {
  const w = mexicoCityMonthWindowFromYm('2026-03')
  assert.equal(w.startInclusiveIso, '2026-03-01T06:00:00.000Z')
  assert.equal(w.endExclusiveIso, '2026-04-01T06:00:00.000Z')
})

test('late-evening March 31 Mexico falls only inside March window, not April', () => {
  const march = mexicoCityMonthWindowFromYm('2026-03')
  const april = mexicoCityMonthWindowFromYm('2026-04')
  // March 31, 2026 19:00 in Mexico City (no DST) = April 1, 2026 01:00 UTC
  const txUtcMs = Date.parse('2026-04-01T01:00:00.000Z')
  assert.equal(formatMexicoCityDateOnly(txUtcMs), '2026-03-31')
  assert.ok(txUtcMs >= march.startInclusiveMs && txUtcMs < march.endExclusiveMs)
  assert.ok(!(txUtcMs >= april.startInclusiveMs && txUtcMs < april.endExclusiveMs))
})

test('formatMexicoCityDateOnly matches exclusive-end minus 1ms for last calendar day', () => {
  const { endExclusiveMs } = mexicoCityMonthWindowFromYm('2026-03')
  assert.equal(formatMexicoCityDateOnly(endExclusiveMs - 1), '2026-03-31')
})
