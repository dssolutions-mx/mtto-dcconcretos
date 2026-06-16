import test from 'node:test'
import assert from 'node:assert/strict'

import {
  matchDepartmentToCanonical,
  resolveCanonicalRoutingDepartments,
} from './incident-routing-departments'

test('maps known department codes to canonical buckets', () => {
  assert.equal(matchDepartmentToCanonical({ name: 'Mantenimiento Planta 1', code: 'MANT' }), 'mantenimiento')
  assert.equal(matchDepartmentToCanonical({ name: 'Operaciones', code: 'OPER' }), 'operaciones')
  assert.equal(matchDepartmentToCanonical({ name: 'Producción', code: 'PROD' }), 'operaciones')
  assert.equal(matchDepartmentToCanonical({ name: 'Recursos Humanos', code: 'RH' }), 'recursos_humanos')
  assert.equal(matchDepartmentToCanonical({ name: 'Calidad', code: 'CAL' }), 'calidad')
})

test('resolves primary ids per canonical department', () => {
  const resolved = resolveCanonicalRoutingDepartments([
    { id: 'd1', name: 'Mantenimiento', code: 'MANT', plant_id: 'p1' },
    { id: 'd2', name: 'Operaciones', code: 'OPER', plant_id: 'p1' },
    { id: 'd3', name: 'RH', code: 'RH', plant_id: 'p1' },
    { id: 'd4', name: 'Calidad', code: 'CAL', plant_id: 'p1' },
    { id: 'd5', name: 'Contabilidad', code: 'CONT', plant_id: 'p1' },
  ])

  assert.equal(resolved.find((r) => r.slug === 'mantenimiento')?.primaryDepartmentId, 'd1')
  assert.equal(resolved.find((r) => r.slug === 'operaciones')?.primaryDepartmentId, 'd2')
  assert.deepEqual(resolved.find((r) => r.slug === 'calidad')?.departmentIds, ['d4'])
})
