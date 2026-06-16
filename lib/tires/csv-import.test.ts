import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CSV_IMPORT_MAX_ROWS,
  generateCsvTemplate,
  parseAndValidateCsvImport,
  parseCsvText,
  validateCsvImportRows,
} from './csv-import'
import { validateRotation } from './rotation'
import { computeFleetAvgCostPerKm, computeReadingCoverage7d } from './fleet-kpis'
import type { Tire, TireEvent } from '@/types/tires'

test('generateCsvTemplate includes header and example row', () => {
  const template = generateCsvTemplate()
  assert.match(template, /^marca,medida/)
  assert.match(template, /Michelin,11R22\.5/)
})

test('parseCsvText handles quoted commas', () => {
  const rows = parseCsvText('marca,medida\n"Michelin, SA",11R22.5\n')
  assert.equal(rows.length, 2)
  assert.equal(rows[1][0], 'Michelin, SA')
})

test('validateCsvImportRows accepts valid row', () => {
  const rows = [
    ['marca', 'medida', 'modelo', 'dot', 'condicion', 'costo_compra', 'fecha_compra'],
    ['Michelin', '11R22.5', 'XDA2', 'DOT123', 'nueva', '18500', '2026-06-01'],
  ]
  const result = validateCsvImportRows(rows)
  assert.equal(result.valid_rows.length, 1)
  assert.equal(result.errors.length, 0)
  assert.equal(result.valid_rows[0].marca, 'Michelin')
})

test('validateCsvImportRows rejects duplicate DOT in file', () => {
  const rows = [
    ['marca', 'medida', 'dot'],
    ['A', '11R22.5', 'DOT999'],
    ['B', '11R22.5', 'dot999'],
  ]
  const result = validateCsvImportRows(rows)
  assert.equal(result.valid_rows.length, 0)
  assert.ok(result.duplicate_dots_in_file.includes('DOT999'))
})

test('validateCsvImportRows rejects existing DOT', () => {
  const rows = [
    ['marca', 'medida', 'dot'],
    ['A', '11R22.5', 'DOTEXIST'],
  ]
  const result = validateCsvImportRows(rows, new Set(['DOTEXIST']))
  assert.equal(result.valid_rows.length, 0)
  assert.ok(result.errors.some((e) => e.field === 'dot'))
})

test('validateCsvImportRows enforces max rows', () => {
  const header = ['marca', 'medida']
  const dataRows = Array.from({ length: CSV_IMPORT_MAX_ROWS + 1 }, () => ['X', '11R22.5'])
  const result = validateCsvImportRows([header, ...dataRows])
  assert.ok(result.errors.some((e) => e.message.includes(String(CSV_IMPORT_MAX_ROWS))))
})

test('parseAndValidateCsvImport end-to-end', () => {
  const csv = generateCsvTemplate()
  const result = parseAndValidateCsvImport(csv)
  assert.equal(result.valid_rows.length, 1)
})

test('validateRotation rejects occupied destination', () => {
  const result = validateRotation({
    from_position_code: 'eje1_izq',
    to_position_code: 'eje1_der',
    occupied_positions: ['eje1_der'],
    positions: [
      { code: 'eje1_izq', label: 'Izq', axle: 1, side: 'izq' },
      { code: 'eje1_der', label: 'Der', axle: 1, side: 'der' },
    ],
  })
  assert.equal(result.ok, false)
})

test('validateRotation accepts empty destination', () => {
  const result = validateRotation({
    from_position_code: 'eje1_izq',
    to_position_code: 'eje1_der',
    occupied_positions: [],
    positions: [
      { code: 'eje1_izq', label: 'Izq', axle: 1, side: 'izq' },
      { code: 'eje1_der', label: 'Der', axle: 1, side: 'der' },
    ],
  })
  assert.equal(result.ok, true)
})

test('computeReadingCoverage7d calculates percentage', () => {
  const now = new Date('2026-06-16T12:00:00Z')
  const result = computeReadingCoverage7d({
    mountedInstallationIds: ['a', 'b', 'c', 'd'],
    readingsByInstallation: new Map([
      ['a', { read_at: '2026-06-15T00:00:00Z' }],
      ['b', { read_at: '2026-06-01T00:00:00Z' }],
    ]),
    now,
  })
  assert.equal(result.withReading, 1)
  assert.equal(result.pct, 25)
})

test('computeFleetAvgCostPerKm averages valid tires', () => {
  const tires: Tire[] = [
    {
      id: 't1',
      serial_number: null,
      brand: 'A',
      model: null,
      size: '11R22.5',
      condition: 'nueva',
      purchase_cost: 1000,
      purchase_date: null,
      status: 'montada',
      min_tread_mm: 3,
      notes: null,
      purchase_order_id: null,
      supplier_id: null,
      po_line_index: null,
      inventory_part_id: null,
      warehouse_id: null,
      plant_id: null,
      created_at: '',
      updated_at: '',
    },
  ]
  const events: TireEvent[] = []
  const result = computeFleetAvgCostPerKm({
    tires,
    events,
    kmByTireId: new Map([['t1', 1000]]),
  })
  assert.equal(result.count, 1)
  assert.equal(result.avg, 1)
})
