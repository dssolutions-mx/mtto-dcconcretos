import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canEditAssetAtPlant,
  canFleetBulkAssignAssetToPlant,
  type FleetActor,
} from './fleet-api-auth'

function actor(overrides: Partial<FleetActor> & Pick<FleetActor, 'role'>): FleetActor {
  return {
    id: 'u1',
    role: overrides.role,
    business_unit_id: overrides.business_unit_id ?? null,
    plant_id: overrides.plant_id ?? null,
  }
}

test('canFleetBulkAssignAssetToPlant: JP moves from own plant to peer plant', () => {
  const jp = actor({ role: 'JEFE_PLANTA', plant_id: 'p-home' })
  assert.equal(
    canFleetBulkAssignAssetToPlant(jp, 'p-home', 'bu1', 'p-other', 'bu1'),
    true
  )
})

test('canFleetBulkAssignAssetToPlant: JP cannot move when neither side is home plant', () => {
  const jp = actor({ role: 'JEFE_PLANTA', plant_id: 'p-home' })
  assert.equal(
    canFleetBulkAssignAssetToPlant(jp, 'p-a', 'bu1', 'p-b', 'bu1'),
    false
  )
})

test('canFleetBulkAssignAssetToPlant: plant-only Coordinador same as JP', () => {
  const c = actor({ role: 'COORDINADOR_MANTENIMIENTO', plant_id: 'p1' })
  assert.equal(canFleetBulkAssignAssetToPlant(c, 'p1', null, 'p2', 'bu1'), true)
  assert.equal(canFleetBulkAssignAssetToPlant(c, 'p9', 'bu1', 'p10', 'bu1'), false)
})

test('canFleetBulkAssignAssetToPlant: BU Coordinador destination must be same BU', () => {
  const c = actor({ role: 'COORDINADOR_MANTENIMIENTO', business_unit_id: 'bu-a' })
  assert.equal(
    canFleetBulkAssignAssetToPlant(c, 'p1', 'bu-a', 'p2', 'bu-a'),
    true
  )
  assert.equal(
    canFleetBulkAssignAssetToPlant(c, 'p1', 'bu-a', 'p2', 'bu-b'),
    false
  )
})

test('canEditAssetAtPlant: Coordinador with BU+plant_id uses BU-wide (matches executor)', () => {
  const c = actor({
    role: 'COORDINADOR_MANTENIMIENTO',
    business_unit_id: 'bu-a',
    plant_id: 'p1',
  })
  assert.equal(canEditAssetAtPlant(c, 'p99', 'bu-a'), true)
  assert.equal(canEditAssetAtPlant(c, 'p99', 'bu-b'), false)
})
