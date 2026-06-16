import test from 'node:test'
import assert from 'node:assert/strict'

import {
  countCompletedTireReadings,
  fieldsFromReadingMode,
  filterPersistableTireReadings,
  isTireReadingComplete,
  normalizeTireReadingsConfig,
  readingModeFromFields,
  validateTireReadingsSection,
} from './tire-readings-validation'
import type { ChecklistTireReadingInput } from '@/lib/tires/checklist-readings'

const baseReading = (patch: Partial<ChecklistTireReadingInput> = {}): ChecklistTireReadingInput => ({
  installation_id: 'inst-1',
  position_code: 'eje1_izq',
  tread_depth_mm: null,
  pressure_psi: null,
  ...patch,
})

test('normalizeTireReadingsConfig applies reading_mode presets', () => {
  assert.deepEqual(normalizeTireReadingsConfig({ reading_mode: 'psi' }), {
    reading_mode: 'psi',
    measure_tread: false,
    measure_pressure: true,
    require_all_positions: true,
  })
  assert.deepEqual(normalizeTireReadingsConfig({ reading_mode: 'mm' }).measure_tread, true)
  assert.deepEqual(normalizeTireReadingsConfig({ reading_mode: 'mm' }).measure_pressure, false)
})

test('readingModeFromFields maps toggles to presets', () => {
  assert.equal(readingModeFromFields(true, true), 'both')
  assert.equal(readingModeFromFields(false, true), 'psi')
  assert.equal(readingModeFromFields(true, false), 'mm')
  assert.equal(readingModeFromFields(false, false), 'none')
})

test('isTireReadingComplete respects psi-only mode', () => {
  const config = normalizeTireReadingsConfig({ reading_mode: 'psi' })
  assert.equal(isTireReadingComplete(baseReading({ tread_depth_mm: 8 }), config), false)
  assert.equal(isTireReadingComplete(baseReading({ pressure_psi: 100 }), config), true)
})

test('isTireReadingComplete respects mm-only mode', () => {
  const config = normalizeTireReadingsConfig({ reading_mode: 'mm' })
  assert.equal(isTireReadingComplete(baseReading({ pressure_psi: 100 }), config), false)
  assert.equal(isTireReadingComplete(baseReading({ tread_depth_mm: 6.5 }), config), true)
})

test('validateTireReadingsSection requires all positions when configured', () => {
  const config = { reading_mode: 'both' as const, require_all_positions: true }
  const readings = [
    baseReading({ installation_id: 'a', tread_depth_mm: 7, pressure_psi: 95 }),
    baseReading({ installation_id: 'b' }),
  ]
  const result = validateTireReadingsSection({
    readings,
    positionCount: 2,
    config,
    sectionTitle: 'Llantas',
  })
  assert.equal(result.valid, false)
  assert.match(result.errors[0], /faltan lecturas/)
})

test('validateTireReadingsSection allows partial when require_all_positions is false', () => {
  const config = { reading_mode: 'psi' as const, require_all_positions: false }
  const readings = [baseReading({ pressure_psi: 100 })]
  const result = validateTireReadingsSection({
    readings,
    positionCount: 3,
    config,
  })
  assert.equal(result.valid, true)
  assert.equal(result.completed, 1)
})

test('validateTireReadingsSection passes with none mode', () => {
  const result = validateTireReadingsSection({
    readings: [],
    positionCount: 5,
    config: { reading_mode: 'none' },
  })
  assert.equal(result.valid, true)
})

test('countCompletedTireReadings counts both fields in both mode', () => {
  const config = normalizeTireReadingsConfig({ reading_mode: 'both' })
  const readings = [
    baseReading({ tread_depth_mm: 8, pressure_psi: 100 }),
    baseReading({ tread_depth_mm: 7 }),
    baseReading({ pressure_psi: 90 }),
  ]
  assert.equal(countCompletedTireReadings(readings, config), 1)
})

test('filterPersistableTireReadings drops irrelevant fields context', () => {
  const config = normalizeTireReadingsConfig({ reading_mode: 'psi' })
  const filtered = filterPersistableTireReadings(
    [baseReading({ tread_depth_mm: 8 }), baseReading({ pressure_psi: 100 })],
    config
  )
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].pressure_psi, 100)
})

test('fieldsFromReadingMode covers all presets', () => {
  assert.deepEqual(fieldsFromReadingMode('both'), { measure_tread: true, measure_pressure: true })
  assert.deepEqual(fieldsFromReadingMode('none'), { measure_tread: false, measure_pressure: false })
})
