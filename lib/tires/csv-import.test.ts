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
  assert.match(template, /^codigo_interno,dot,marca,medida/)
  assert.match(template, /Michelin,11R22\.5/)
})

test('parseCsvText handles quoted commas', () => {
  const rows = parseCsvText('marca,medida\n"Michelin, SA",11R22.5\n')
  assert.equal(rows.length, 2)
  assert.equal(rows[1][0], 'Michelin, SA')
})

test('validateCsvImportRows accepts valid row with readings', () => {
  const rows = [
    [
      'codigo_interno',
      'dot',
      'marca',
      'medida',
      'modelo',
      'condicion',
      'costo_compra',
      'fecha_compra',
      'almacen',
      'banda_mm',
      'presion_psi',
    ],
    [
      'LL-P1-001',
      'DOT123',
      'Michelin',
      '11R22.5',
      'XDA2',
      'nueva',
      '18500',
      '2026-06-01',
      '',
      '14.5',
      '100',
    ],
  ]
  const result = validateCsvImportRows(rows)
  assert.equal(result.valid_rows.length, 1)
  assert.equal(result.errors.length, 0)
  assert.equal(result.valid_rows[0].marca, 'Michelin')
  assert.equal(result.valid_rows[0].banda_mm, 14.5)
  assert.equal(result.valid_rows[0].presion_psi, 100)
  assert.equal(result.valid_rows[0].codigo_interno, 'LL-P1-001')
})

test('validateCsvImportRows accepts tread_mm alias', () => {
  const rows = [
    ['marca', 'medida', 'tread_mm', 'pressure_psi'],
    ['Michelin', '11R22.5', '12', '95'],
  ]
  const result = validateCsvImportRows(rows)
  assert.equal(result.valid_rows.length, 1)
  assert.equal(result.valid_rows[0].banda_mm, 12)
  assert.equal(result.valid_rows[0].presion_psi, 95)
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

test('validateCsvImportRows rejects duplicate internal code in file', () => {
  const rows = [
    ['marca', 'medida', 'codigo_interno'],
    ['A', '11R22.5', 'LL-001'],
    ['B', '11R22.5', 'll-001'],
  ]
  const result = validateCsvImportRows(rows)
  assert.equal(result.valid_rows.length, 0)
  assert.ok(result.duplicate_internal_codes_in_file.includes('LL-001'))
})

test('validateCsvImportRows rejects existing DOT', () => {
  const rows = [
    ['marca', 'medida', 'dot'],
    ['A', '11R22.5', 'DOTEXIST'],
  ]
  const result = validateCsvImportRows(rows, { existingDots: new Set(['DOTEXIST']) })
  assert.equal(result.valid_rows.length, 0)
  assert.ok(result.errors.some((e) => e.field === 'dot'))
})

test('validateCsvImportRows enforces dot_required from id rules', () => {
  const rows = [
    ['marca', 'medida'],
    ['A', '11R22.5'],
  ]
  const result = validateCsvImportRows(rows, { idRules: { dot_required: true } })
  assert.equal(result.valid_rows.length, 0)
  assert.ok(result.errors.some((e) => e.field === 'dot'))
})

test('validateCsvImportRows resolves warehouse code', () => {
  const rows = [
    ['marca', 'medida', 'almacen'],
    ['A', '11R22.5', 'ALM-01'],
  ]
  const result = validateCsvImportRows(rows, {
    warehouseCodes: new Map([['ALM-01', 'uuid-warehouse-1']]),
    warehouseIds: new Set(['uuid-warehouse-1']),
  })
  assert.equal(result.valid_rows.length, 1)
  assert.equal(result.valid_rows[0].almacen_id, 'uuid-warehouse-1')
})

test('validateCsvImportRows rejects invalid tread', () => {
  const rows = [
    ['marca', 'medida', 'banda_mm'],
    ['A', '11R22.5', '999'],
  ]
  const result = validateCsvImportRows(rows)
  assert.equal(result.valid_rows.length, 0)
  assert.ok(result.errors.some((e) => e.field === 'banda_mm'))
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
