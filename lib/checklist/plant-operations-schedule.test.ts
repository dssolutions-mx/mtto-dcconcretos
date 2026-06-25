import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PLANTA_MODEL_ID,
  DEFAULT_EXECUTOR_ROLES,
  PLANT_EXECUTOR_ROLES,
  executorRolesForModel,
  isPlantaAsset,
  normalizeExecutorRoles,
  roleInExecutorRoles,
} from './executor-roles'
import { scheduleVisibleToOperatorAssignment } from './executor-authorization'
import { summarizePlantControlReadiness, computeDueStatus, monthlyClosureCountdown, monthlyScheduleDayKey, monthPeriodFromTodayKey, monthlySchedulePairExists } from './plant-operations-schedule'

test('isPlantaAsset detects PLANTA model id and maintenance_unit none', () => {
  assert.equal(isPlantaAsset({ modelId: PLANTA_MODEL_ID }), true)
  assert.equal(isPlantaAsset({ maintenanceUnit: 'none' }), true)
  assert.equal(isPlantaAsset({ modelId: 'other', maintenanceUnit: 'hours' }), false)
})

test('executorRolesForModel presets PLANTA templates', () => {
  assert.deepEqual(executorRolesForModel(PLANTA_MODEL_ID), PLANT_EXECUTOR_ROLES)
  assert.deepEqual(executorRolesForModel('x', 'none'), PLANT_EXECUTOR_ROLES)
  assert.deepEqual(executorRolesForModel('x', 'hours'), DEFAULT_EXECUTOR_ROLES)
})

test('normalizeExecutorRoles falls back to defaults when empty', () => {
  assert.deepEqual(normalizeExecutorRoles(null), DEFAULT_EXECUTOR_ROLES)
  assert.deepEqual(normalizeExecutorRoles([]), DEFAULT_EXECUTOR_ROLES)
  assert.deepEqual(normalizeExecutorRoles(['INVALID_ROLE']), DEFAULT_EXECUTOR_ROLES)
})

test('roleInExecutorRoles respects template executor_roles', () => {
  assert.equal(roleInExecutorRoles('OPERADOR', PLANT_EXECUTOR_ROLES), false)
  assert.equal(roleInExecutorRoles('DOSIFICADOR', PLANT_EXECUTOR_ROLES), true)
})

test('scheduleVisibleToOperatorAssignment excludes PLANTA without assignment', () => {
  const plantSchedule = {
    checklists: { executor_roles: ['OPERADOR', 'DOSIFICADOR'] },
    assets: {
      model_id: PLANTA_MODEL_ID,
      equipment_models: { maintenance_unit: 'none' },
    },
  }
  assert.equal(
    scheduleVisibleToOperatorAssignment(plantSchedule, new Set(['other']), 'planta-1'),
    false
  )
  assert.equal(
    scheduleVisibleToOperatorAssignment(
      plantSchedule,
      new Set(['planta-1']),
      'planta-1'
    ),
    true
  )
})

test('scheduleVisibleToOperatorAssignment requires OPERADOR in executor_roles', () => {
  const schedule = {
    checklists: { executor_roles: ['DOSIFICADOR', 'JEFE_PLANTA'] },
    assets: { model_id: 'truck', equipment_models: { maintenance_unit: 'hours' } },
  }
  assert.equal(
    scheduleVisibleToOperatorAssignment(schedule, new Set(['a1']), 'a1'),
    false
  )
})

test('summarizePlantControlReadiness reports pending plant control', () => {
  const summary = summarizePlantControlReadiness([
    {
      scheduleId: 's1',
      assetId: 'a1',
      assetCode: 'PLT-1',
      assetName: 'Planta',
      checklistName: 'Control diario',
      status: 'pendiente',
      scheduledDay: '2026-06-25',
    },
  ])
  assert.equal(summary.readiness, 'pendiente')
  assert.equal(summary.pendingScheduleId, 's1')
})

test('summarizePlantControlReadiness is listo when all completed', () => {
  const summary = summarizePlantControlReadiness([
    {
      scheduleId: 's1',
      assetId: 'a1',
      assetCode: 'PLT-1',
      assetName: 'Planta',
      checklistName: 'Control diario',
      status: 'completado',
      scheduledDay: '2026-06-25',
    },
  ])
  assert.equal(summary.readiness, 'listo')
  assert.equal(summary.pendingScheduleId, null)
})

test('computeDueStatus daily — on_time when completed', () => {
  assert.equal(
    computeDueStatus(
      { scheduledDay: '2026-06-20', status: 'completado', frequency: 'diario' },
      { todayKey: '2026-06-25' }
    ),
    'on_time'
  )
})

test('computeDueStatus daily — due_today on scheduled day', () => {
  assert.equal(
    computeDueStatus(
      { scheduledDay: '2026-06-25', status: 'pendiente', frequency: 'diario' },
      { todayKey: '2026-06-25' }
    ),
    'due_today'
  )
})

test('computeDueStatus daily — overdue after scheduled day', () => {
  assert.equal(
    computeDueStatus(
      { scheduledDay: '2026-06-24', status: 'pendiente', frequency: 'diario' },
      { todayKey: '2026-06-25' }
    ),
    'overdue'
  )
})

test('computeDueStatus daily — on_time before scheduled day', () => {
  assert.equal(
    computeDueStatus(
      { scheduledDay: '2026-06-26', status: 'pendiente', frequency: 'diario' },
      { todayKey: '2026-06-25' }
    ),
    'on_time'
  )
})

test('computeDueStatus monthly bonus_closure — due on deadline day 24', () => {
  assert.equal(
    computeDueStatus(
      {
        scheduledDay: '2026-06-01',
        status: 'pendiente',
        frequency: 'mensual',
        isBonusClosure: true,
      },
      { todayKey: '2026-06-24', deadlineDay: 24 }
    ),
    'due_today'
  )
})

test('computeDueStatus monthly bonus_closure — overdue after day 24', () => {
  assert.equal(
    computeDueStatus(
      {
        scheduledDay: '2026-06-01',
        status: 'pendiente',
        frequency: 'mensual',
        isBonusClosure: true,
      },
      { todayKey: '2026-06-25', deadlineDay: 24 }
    ),
    'overdue'
  )
})

test('computeDueStatus monthly bonus_closure — on_time before deadline', () => {
  assert.equal(
    computeDueStatus(
      {
        scheduledDay: '2026-06-01',
        status: 'pendiente',
        frequency: 'mensual',
        isBonusClosure: true,
      },
      { todayKey: '2026-06-20', deadlineDay: 24 }
    ),
    'on_time'
  )
})

test('monthlyClosureCountdown returns days until deadline', () => {
  assert.equal(
    monthlyClosureCountdown('2026-06-01', { todayKey: '2026-06-20', deadlineDay: 24 }),
    4
  )
  assert.equal(
    monthlyClosureCountdown('2026-06-01', { todayKey: '2026-06-24', deadlineDay: 24 }),
    0
  )
  assert.equal(
    monthlyClosureCountdown('2026-06-01', { todayKey: '2026-06-25', deadlineDay: 24 }),
    -1
  )
})

test('monthlyScheduleDayKey uses first day of month', () => {
  assert.equal(monthlyScheduleDayKey(2026, 6), '2026-06-01')
  assert.equal(monthlyScheduleDayKey(2026, 12), '2026-12-01')
})

test('monthPeriodFromTodayKey derives month prefix and schedule day', () => {
  const period = monthPeriodFromTodayKey('2026-06-25')
  assert.equal(period.year, 2026)
  assert.equal(period.month, 6)
  assert.equal(period.monthPrefix, '2026-06')
  assert.equal(period.scheduleDay, '2026-06-01')
})

test('monthlySchedulePairExists detects asset+template in month', () => {
  const existing = [
    { asset_id: 'asset-a', template_id: 'tpl-1' },
    { asset_id: 'asset-b', template_id: 'tpl-1' },
  ]
  assert.equal(monthlySchedulePairExists(existing, 'asset-a', 'tpl-1'), true)
  assert.equal(monthlySchedulePairExists(existing, 'asset-a', 'tpl-2'), false)
  assert.equal(monthlySchedulePairExists(existing, 'asset-c', 'tpl-1'), false)
})
