import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getDiagramGeometry,
  getPositionVisualState,
} from './diagram-geometry'
import { TRUCK_6WHEEL_POSITIONS, VEHICLE_4WHEEL_POSITIONS } from './positions'
import type { AssetTireInstallation } from '@/types/tires'

test('getDiagramGeometry returns 10 tire coords for truck_6x4', () => {
  const geo = getDiagramGeometry('truck_6x4', TRUCK_6WHEEL_POSITIONS)
  assert.equal(geo.tires.length, 10)
  assert.equal(geo.viewBox, '0 0 400 450')
  const codes = geo.tires.map((t) => t.code)
  assert.ok(codes.includes('eje2_izq_ext'))
  assert.ok(codes.includes('eje3_der_ext'))
})

test('getDiagramGeometry returns 4 tire coords for vehicle_4wheel', () => {
  const geo = getDiagramGeometry('vehicle_4wheel', VEHICLE_4WHEEL_POSITIONS)
  assert.equal(geo.tires.length, 4)
  assert.equal(geo.viewBox, '0 0 300 400')
})

test('getDiagramGeometry assigns fallback coords for custom template', () => {
  const custom = [{ code: 'custom_a', label: 'A', axle: 1, side: 'izq' as const }]
  const geo = getDiagramGeometry('custom', custom)
  assert.equal(geo.tires.length, 1)
  assert.ok(geo.tires[0].cx > 0)
  assert.ok(geo.tires[0].cy > 0)
})

test('getPositionVisualState returns empty without installation', () => {
  assert.equal(getPositionVisualState(undefined), 'empty')
})

test('getPositionVisualState returns ok for mounted tire without alerts', () => {
  const inst = {
    tire: { min_tread_mm: 3 },
    latest_reading: { tread_depth_mm: 8, pressure_psi: 100 },
  } as AssetTireInstallation
  assert.equal(getPositionVisualState(inst), 'ok')
})

test('getPositionVisualState returns alert for low tread', () => {
  const inst = {
    tire: { min_tread_mm: 3 },
    latest_reading: { tread_depth_mm: 2.5, pressure_psi: 100 },
  } as AssetTireInstallation
  assert.equal(getPositionVisualState(inst), 'alert')
})

test('getPositionVisualState returns alert for out-of-range pressure', () => {
  const inst = {
    tire: { min_tread_mm: 3 },
    latest_reading: { tread_depth_mm: 8, pressure_psi: 60 },
  } as AssetTireInstallation
  assert.equal(getPositionVisualState(inst), 'alert')
})
