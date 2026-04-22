import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldUpdateOperatorProfileForPlantTransfer } from './should-update-operator-profile-for-plant-transfer.ts'

test('allows transfer when operator has no plant', () => {
  assert.equal(
    shouldUpdateOperatorProfileForPlantTransfer(
      { plant_id: null, business_unit_id: 'bu-1' },
      'bu-1'
    ),
    true
  )
})

test('allows transfer when operator plant is set but business_unit_id is null (same-BU move path)', () => {
  assert.equal(
    shouldUpdateOperatorProfileForPlantTransfer(
      { plant_id: 'plant-old', business_unit_id: null },
      'bu-dest'
    ),
    true
  )
})

test('allows transfer when operator BU matches destination BU', () => {
  assert.equal(
    shouldUpdateOperatorProfileForPlantTransfer(
      { plant_id: 'plant-old', business_unit_id: 'bu-a' },
      'bu-a'
    ),
    true
  )
})

test('blocks transfer when operator BU differs from destination', () => {
  assert.equal(
    shouldUpdateOperatorProfileForPlantTransfer(
      { plant_id: 'plant-old', business_unit_id: 'bu-a' },
      'bu-b'
    ),
    false
  )
})

test('allows when both BUs are null', () => {
  assert.equal(
    shouldUpdateOperatorProfileForPlantTransfer(
      { plant_id: 'p1', business_unit_id: null },
      null
    ),
    true
  )
})
