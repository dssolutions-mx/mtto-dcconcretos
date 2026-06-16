import test from 'node:test'
import assert from 'node:assert/strict'

import {
  aggregateTireExceptions,
  buildExceptionId,
  computeCostPerKmPercentile90,
  countExceptionsByPriority,
  daysSinceDate,
  detectCoverageExceptions,
  detectInstallationExceptions,
  isReadingStale,
  sortTireExceptions,
} from './exceptions'
import type { AssetTireInstallation, Tire } from '@/types/tires'

const tire: Tire = {
  id: 'tire-1',
  serial_number: 'DOT123',
  brand: 'Michelin',
  model: 'XDA2',
  size: '11R22.5',
  condition: 'nueva',
  purchase_cost: 18000,
  purchase_date: '2026-01-01',
  status: 'montada',
  min_tread_mm: 3,
  notes: null,
  purchase_order_id: null,
  supplier_id: null,
  po_line_index: null,
  inventory_part_id: null,
  warehouse_id: null,
  plant_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const installation: AssetTireInstallation = {
  id: 'inst-1',
  tire_id: 'tire-1',
  asset_id: 'asset-1',
  position_code: 'eje2_izq_ext',
  position_label: 'Eje 2 — Izq. exterior',
  axle_number: 2,
  installed_at: '2026-06-01T00:00:00Z',
  removed_at: null,
  km_at_install: 1000,
  hours_at_install: null,
  km_at_remove: null,
  hours_at_remove: null,
  installed_by: null,
  work_order_id: null,
  notes: null,
  created_at: '2026-06-01T00:00:00Z',
  tire,
}

test('daysSinceDate returns whole days elapsed', () => {
  const now = new Date('2026-06-16T12:00:00Z')
  assert.equal(daysSinceDate('2026-06-01T00:00:00Z', now), 15)
})

test('isReadingStale treats missing days as stale', () => {
  assert.equal(isReadingStale(null, 14), true)
  assert.equal(isReadingStale(10, 14), false)
  assert.equal(isReadingStale(15, 14), true)
})

test('detectInstallationExceptions flags tread critical as P1', () => {
  const exceptions = detectInstallationExceptions({
    installation: {
      ...installation,
      latest_reading: {
        id: 'r1',
        installation_id: 'inst-1',
        tire_id: 'tire-1',
        asset_id: 'asset-1',
        read_at: '2026-06-15T00:00:00Z',
        tread_depth_mm: 2.1,
        pressure_psi: 100,
        odometer_km: null,
        horometer_hours: null,
        recorded_by: null,
        checklist_id: null,
        position_code: 'eje2_izq_ext',
        notes: null,
        created_at: '2026-06-15T00:00:00Z',
      },
    },
    asset_name: 'Camión #08',
    now: new Date('2026-06-16T00:00:00Z'),
  })

  const tread = exceptions.find((e) => e.type === 'tread_critical')
  assert.ok(tread)
  assert.equal(tread?.priority, 'P1')
  assert.match(tread?.description ?? '', /2\.1 mm/)
})

test('detectInstallationExceptions flags pressure critical as P1', () => {
  const exceptions = detectInstallationExceptions({
    installation: {
      ...installation,
      latest_reading: {
        id: 'r1',
        installation_id: 'inst-1',
        tire_id: 'tire-1',
        asset_id: 'asset-1',
        read_at: '2026-06-15T00:00:00Z',
        tread_depth_mm: 8,
        pressure_psi: 70,
        odometer_km: null,
        horometer_hours: null,
        recorded_by: null,
        checklist_id: null,
        position_code: 'eje2_izq_ext',
        notes: null,
        created_at: '2026-06-15T00:00:00Z',
      },
    },
    asset_name: 'Camión #08',
    now: new Date('2026-06-16T00:00:00Z'),
  })

  assert.ok(exceptions.some((e) => e.type === 'pressure_critical' && e.priority === 'P1'))
})

test('detectInstallationExceptions flags stale reading as P2', () => {
  const exceptions = detectInstallationExceptions({
    installation: {
      ...installation,
      latest_reading: {
        id: 'r1',
        installation_id: 'inst-1',
        tire_id: 'tire-1',
        asset_id: 'asset-1',
        read_at: '2026-05-01T00:00:00Z',
        tread_depth_mm: 8,
        pressure_psi: 100,
        odometer_km: null,
        horometer_hours: null,
        recorded_by: null,
        checklist_id: null,
        position_code: 'eje2_izq_ext',
        notes: null,
        created_at: '2026-05-01T00:00:00Z',
      },
    },
    asset_name: 'Camión #08',
    now: new Date('2026-06-16T00:00:00Z'),
  })

  const stale = exceptions.find((e) => e.type === 'no_reading')
  assert.ok(stale)
  assert.equal(stale?.priority, 'P2')
})

test('detectCoverageExceptions returns no_layout when missing layout', () => {
  const exceptions = detectCoverageExceptions({
    asset_id: 'asset-2',
    asset_name: 'Loader #03',
    has_model: true,
    has_layout: false,
    mounted_count: 0,
    total_positions: 0,
  })

  assert.equal(exceptions.length, 1)
  assert.equal(exceptions[0]?.type, 'no_layout')
  assert.equal(exceptions[0]?.priority, 'P2')
})

test('detectCoverageExceptions returns incomplete coverage as P2', () => {
  const exceptions = detectCoverageExceptions({
    asset_id: 'asset-3',
    asset_name: 'Camión #08',
    has_model: true,
    has_layout: true,
    mounted_count: 4,
    total_positions: 10,
  })

  assert.equal(exceptions[0]?.type, 'incomplete_coverage')
  assert.equal(exceptions[0]?.coverage_pct, 40)
})

test('computeCostPerKmPercentile90 picks 90th value', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  assert.equal(computeCostPerKmPercentile90(values), 9)
})

test('sortTireExceptions orders P1 before P2 before P3', () => {
  const sorted = sortTireExceptions([
    {
      id: 'a',
      priority: 'P3',
      type: 'anomalous_cost',
      title: 'Z',
      description: '',
      suggested_action: '',
    },
    {
      id: 'b',
      priority: 'P1',
      type: 'tread_critical',
      title: 'A',
      description: '',
      suggested_action: '',
    },
    {
      id: 'c',
      priority: 'P2',
      type: 'no_reading',
      title: 'M',
      description: '',
      suggested_action: '',
    },
  ])

  assert.deepEqual(sorted.map((e) => e.priority), ['P1', 'P2', 'P3'])
})

test('aggregateTireExceptions deduplicates by id', () => {
  const id = buildExceptionId({
    type: 'no_layout',
    asset_id: 'asset-2',
  })
  const merged = aggregateTireExceptions([
    [
      {
        id,
        priority: 'P2',
        type: 'no_layout',
        title: 'Loader',
        description: 'A',
        suggested_action: 'Asignar layout',
        asset_id: 'asset-2',
      },
    ],
    [
      {
        id,
        priority: 'P2',
        type: 'no_layout',
        title: 'Loader',
        description: 'B',
        suggested_action: 'Asignar layout',
        asset_id: 'asset-2',
      },
    ],
  ])

  assert.equal(merged.length, 1)
})

test('countExceptionsByPriority sums totals', () => {
  const counts = countExceptionsByPriority([
    {
      id: '1',
      priority: 'P1',
      type: 'tread_critical',
      title: '',
      description: '',
      suggested_action: '',
    },
    {
      id: '2',
      priority: 'P2',
      type: 'no_reading',
      title: '',
      description: '',
      suggested_action: '',
    },
    {
      id: '3',
      priority: 'P2',
      type: 'no_layout',
      title: '',
      description: '',
      suggested_action: '',
    },
  ])

  assert.equal(counts.P1, 1)
  assert.equal(counts.P2, 2)
  assert.equal(counts.total, 3)
})
