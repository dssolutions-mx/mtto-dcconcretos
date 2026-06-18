import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canManageIncidentSlaTargets,
  formatSlaTargetMatchSummary,
  validateSlaTargetInput,
} from '@/lib/incidents/incident-sla-targets'

test('validateSlaTargetInput accepts valid defaults', () => {
  const result = validateSlaTargetInput({ name: 'Impacto alto' })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.data.priority, 100)
  assert.equal(result.data.target_ack_hours, 24)
  assert.equal(result.data.target_schedule_hours, 48)
  assert.equal(result.data.target_resolve_hours, 168)
})

test('validateSlaTargetInput rejects empty name when required', () => {
  const result = validateSlaTargetInput({ name: '   ' })
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.match(result.error, /nombre/i)
})

test('validateSlaTargetInput rejects negative priority', () => {
  const result = validateSlaTargetInput({ name: 'Test', priority: -1 })
  assert.equal(result.ok, false)
})

test('validateSlaTargetInput rejects non-positive hour targets', () => {
  const ack = validateSlaTargetInput({ name: 'Test', target_ack_hours: 0 })
  assert.equal(ack.ok, false)

  const schedule = validateSlaTargetInput({ name: 'Test', target_schedule_hours: -5 })
  assert.equal(schedule.ok, false)
})

test('validateSlaTargetInput rejects invalid impact values', () => {
  const result = validateSlaTargetInput({ name: 'Test', match_impact: 'Crítico' })
  assert.equal(result.ok, false)
})

test('validateSlaTargetInput normalizes optional matchers', () => {
  const result = validateSlaTargetInput({
    name: 'Predeterminado',
    match_impact: 'Alto',
    match_incident_type: '  ',
    plant_id: '',
    match_department_id: null,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.data.match_impact, 'Alto')
  assert.equal(result.data.match_incident_type, null)
  assert.equal(result.data.plant_id, null)
})

test('canManageIncidentSlaTargets allows maintenance and config writers', () => {
  assert.equal(
    canManageIncidentSlaTargets({ role: 'GERENTE_MANTENIMIENTO' }),
    true,
  )
  assert.equal(
    canManageIncidentSlaTargets({ role: 'AREA_ADMINISTRATIVA' }),
    true,
  )
  assert.equal(canManageIncidentSlaTargets({ role: 'COORDINADOR_MANTENIMIENTO' }), true)
  assert.equal(canManageIncidentSlaTargets({ role: 'OPERADOR' }), false)
  assert.equal(canManageIncidentSlaTargets({ role: 'VISUALIZADOR' }), false)
})

test('formatSlaTargetMatchSummary lists configured criteria', () => {
  const summary = formatSlaTargetMatchSummary({
    id: '1',
    name: 'Alto',
    is_active: true,
    priority: 10,
    plant_id: 'p1',
    match_incident_type: 'Falla',
    match_impact: 'Alto',
    match_department_id: 'd1',
    target_ack_hours: 8,
    target_schedule_hours: 24,
    target_resolve_hours: 72,
    created_at: '',
    updated_at: '',
    plants: { id: 'p1', name: 'Planta 1', code: 'P1' },
    departments: { id: 'd1', name: 'Mantenimiento', code: 'MANT' },
  })

  assert.match(summary, /Planta 1/)
  assert.match(summary, /Impacto Alto/)
  assert.match(summary, /Falla/)
  assert.match(summary, /Mantenimiento/)
})
