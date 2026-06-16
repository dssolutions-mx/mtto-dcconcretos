import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatTirePrimaryId,
  formatTireSecondaryDot,
  formatTireSelectOption,
  isMeaningfulDot,
} from './display'
import { formatThresholdSummary, normalizeTireThresholds, validateTireThresholds } from './thresholds-ui'

describe('isMeaningfulDot', () => {
  it('rejects short and repeated placeholders', () => {
    assert.equal(isMeaningfulDot('eee'), false)
    assert.equal(isMeaningfulDot('abc'), false)
    assert.equal(isMeaningfulDot('0123 ABCD 4521'), true)
  })
})

describe('formatTirePrimaryId', () => {
  it('prefers internal_code over placeholder DOT', () => {
    assert.equal(
      formatTirePrimaryId({
        internal_code: 'DC-LL-P1-2026-00421',
        serial_number: 'eee',
        brand: 'eee',
        size: 'eee',
      }),
      'DC-LL-P1-2026-00421'
    )
  })
})

describe('formatTireSecondaryDot', () => {
  it('hides placeholder serial', () => {
    assert.equal(
      formatTireSecondaryDot({ internal_code: 'LL-2026-00001', serial_number: 'eee' }),
      null
    )
  })
})

describe('formatThresholdSummary', () => {
  it('includes fleet defaults in Spanish', () => {
    const line = formatThresholdSummary(undefined, 3)
    assert.match(line, /Umbral banda: 3 mm/)
    assert.match(line, /Advertencia ≤ 5 mm/)
    assert.match(line, /Presión: 80–120 psi/)
  })
})

describe('validateTireThresholds', () => {
  it('rejects invalid pressure range', () => {
    assert.equal(
      validateTireThresholds({
        min_tread_mm: 3,
        pressure_min_psi: 120,
        pressure_max_psi: 80,
        days_without_reading: 14,
      }),
      'La presión mínima debe ser menor que la presión máxima.'
    )
  })

  it('normalizes partial fleet settings', () => {
    const normalized = normalizeTireThresholds({ min_tread_mm: 4 })
    assert.equal(normalized.min_tread_mm, 4)
    assert.equal(normalized.pressure_min_psi, 80)
    assert.equal(normalized.days_without_reading, 14)
  })
})

describe('formatTireSelectOption', () => {
  it('combines id, spec and dot', () => {
    const label = formatTireSelectOption({
      internal_code: 'LL-2026-00001',
      serial_number: '0123 ABCD 4521',
      brand: 'Michelin',
      size: '11R22.5',
      model: null,
    })
    assert.match(label, /LL-2026-00001/)
    assert.match(label, /DOT 0123 ABCD 4521/)
  })
})
