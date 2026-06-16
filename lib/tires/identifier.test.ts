import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildInternalCodePrefix,
  formatInternalCode,
  parseSequenceFromInternalCode,
  previewInternalCode,
  validateTireIdentityInput,
} from './identifier'

describe('buildInternalCodePrefix', () => {
  it('uses default LL prefix and year', () => {
    assert.equal(buildInternalCodePrefix({}, null, 2026), 'LL-2026')
  })

  it('includes custom prefix and plant code', () => {
    assert.equal(buildInternalCodePrefix({ internal_prefix: 'DC-LL' }, 'p1', 2026), 'DC-LL-P1-2026')
  })
})

describe('formatInternalCode', () => {
  it('zero-pads sequence to 5 digits', () => {
    assert.equal(
      formatInternalCode({ prefix: 'LL', plantCode: 'P1', year: 2026, sequence: 421 }),
      'LL-P1-2026-00421'
    )
  })
})

describe('parseSequenceFromInternalCode', () => {
  it('parses trailing sequence', () => {
    const prefix = buildInternalCodePrefix({ internal_prefix: 'DC-LL' }, 'P1', 2026)
    assert.equal(parseSequenceFromInternalCode('DC-LL-P1-2026-00421', prefix), 421)
  })

  it('returns null for non-matching prefix', () => {
    assert.equal(parseSequenceFromInternalCode('OTHER-2026-00001', 'LL-2026'), null)
  })
})

describe('previewInternalCode', () => {
  it('shows manual prefix when auto_generate is off', () => {
    assert.equal(
      previewInternalCode({ rules: { internal_prefix: 'DC-LL', auto_generate: false } }),
      'DC-LL-12345 (manual)'
    )
  })

  it('shows formatted auto code when auto_generate is on', () => {
    assert.equal(
      previewInternalCode({
        rules: { internal_prefix: 'DC-LL', auto_generate: true },
        plantCode: 'P1',
        year: 2026,
        sequence: 1,
      }),
      'DC-LL-P1-2026-00001'
    )
  })
})

describe('validateTireIdentityInput', () => {
  it('requires DOT when dot_required', () => {
    assert.equal(
      validateTireIdentityInput({ dot_required: true }, { serialNumber: null }),
      'DOT / serial es obligatorio según la configuración de flota'
    )
  })

  it('allows empty serial when auto_generate', () => {
    assert.equal(
      validateTireIdentityInput({ auto_generate: true }, { serialNumber: null }),
      null
    )
  })
})
