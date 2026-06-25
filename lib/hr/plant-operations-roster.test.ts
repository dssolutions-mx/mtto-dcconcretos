import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildPlantOperationsRoster,
  isOperatorProfile,
  mergePlantOperationsRoster,
} from './plant-operations-roster'

describe('plant-operations-roster', () => {
  it('isOperatorProfile — OPERADOR only, excludes DOSIFICADOR', () => {
    assert.equal(isOperatorProfile({ role: 'OPERADOR' }), true)
    assert.equal(isOperatorProfile({ business_role: 'OPERADOR' }), true)
    assert.equal(isOperatorProfile({ role: 'OPERADOR', business_role: 'DOSIFICADOR' }), true)
    assert.equal(isOperatorProfile({ role: 'DOSIFICADOR', business_role: 'OPERADOR' }), false)
    assert.equal(isOperatorProfile({ role: 'DOSIFICADOR' }), false)
    assert.equal(isOperatorProfile({ role: 'MECANICO' }), false)
  })

  it('mergePlantOperationsRoster — home only', () => {
    const result = mergePlantOperationsRoster(
      [
        {
          id: 'op-1',
          nombre: 'Ana',
          apellido: 'López',
          home_plant_id: 'plant-a',
        },
      ],
      []
    )
    assert.equal(result.length, 1)
    assert.equal(result[0].source, 'home_plant')
  })

  it('mergePlantOperationsRoster — assignment only', () => {
    const result = mergePlantOperationsRoster(
      [],
      [
        {
          id: 'op-2',
          nombre: 'Bruno',
          apellido: 'Díaz',
          employee_code: 'E002',
          home_plant_id: 'plant-b',
        },
      ]
    )
    assert.equal(result.length, 1)
    assert.equal(result[0].source, 'asset_assignment')
    assert.equal(result[0].employee_code, 'E002')
  })

  it('mergePlantOperationsRoster — dedupe both', () => {
    const result = mergePlantOperationsRoster(
      [
        {
          id: 'op-1',
          nombre: 'Ana',
          apellido: 'López',
          home_plant_id: 'plant-a',
        },
      ],
      [
        {
          id: 'op-1',
          nombre: 'Ana',
          apellido: 'López',
          home_plant_id: 'plant-a',
        },
        {
          id: 'op-3',
          nombre: 'Carlos',
          apellido: 'Ruiz',
          home_plant_id: 'plant-b',
        },
      ]
    )
    assert.equal(result.length, 2)
    const ana = result.find((r) => r.id === 'op-1')!
    assert.equal(ana.source, 'both')
    const carlos = result.find((r) => r.id === 'op-3')!
    assert.equal(carlos.source, 'asset_assignment')
  })

  it('mergePlantOperationsRoster — sorts by nombre then apellido', () => {
    const result = mergePlantOperationsRoster(
      [
        { id: 'b', nombre: 'Bruno', apellido: 'Zapata', home_plant_id: 'p' },
        { id: 'a', nombre: 'Ana', apellido: 'Mora', home_plant_id: 'p' },
      ],
      []
    )
    assert.deepEqual(result.map((r) => r.id), ['a', 'b'])
  })

  it('buildPlantOperationsRoster — mock path delegates to merge', async () => {
    const result = await buildPlantOperationsRoster({} as never, 'plant-a', {
      _mock: {
        homePlantOperators: [
          { id: 'op-1', nombre: 'Ana', apellido: 'López', home_plant_id: 'plant-a' },
        ],
        assetAssignmentOperators: [
          { id: 'op-2', nombre: 'Bruno', apellido: 'Díaz', home_plant_id: 'plant-b' },
        ],
      },
    })
    assert.equal(result.length, 2)
    assert.equal(result[0].source, 'home_plant')
    assert.equal(result[1].source, 'asset_assignment')
  })
})
