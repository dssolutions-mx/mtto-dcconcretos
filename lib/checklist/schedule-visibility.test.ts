import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PLANTA_MODEL_ID } from '@/lib/checklist/executor-roles'
import type { ActorContext } from '@/lib/auth/server-authorization'
import {
  isAssetVisibleToActor,
  isScheduleVisibleToActor,
} from './schedule-visibility'

function actor(
  role: string,
  plantIds: string[] = [],
  userId = 'user-1'
): ActorContext {
  return {
    userId,
    profile: {
      id: userId,
      role,
      business_unit_id: null,
      plant_id: plantIds[0] ?? null,
      managed_plant_ids: plantIds,
      can_authorize_up_to: null,
    },
    effectiveBusinessRole: null,
    scope: 'plant',
    authorizationLimit: 0,
  }
}

const plantAsset = {
  id: 'asset-planta',
  plant_id: 'plant-1',
  model_id: PLANTA_MODEL_ID,
  equipment_models: { maintenance_unit: 'none' },
}

const unitAsset = {
  id: 'asset-unit',
  plant_id: 'plant-1',
  model_id: 'model-truck',
  equipment_models: { maintenance_unit: 'hours' },
}

describe('isScheduleVisibleToActor', () => {
  it('hides PLANTA schedules from MECANICO even if in executor_roles', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: plantAsset.id,
        checklists: { executor_roles: ['MECANICO', 'DOSIFICADOR'] },
      },
      actor('MECANICO', ['plant-1']),
      null,
      plantAsset
    )
    assert.equal(visible, false)
  })

  it('shows PLANTA schedules to DOSIFICADOR with plant scope', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: plantAsset.id,
        checklists: { executor_roles: ['DOSIFICADOR', 'JEFE_PLANTA'] },
      },
      actor('DOSIFICADOR', ['plant-1']),
      null,
      plantAsset
    )
    assert.equal(visible, true)
  })

  it('hides PLANTA schedules when dosificador lacks plant scope', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: plantAsset.id,
        checklists: { executor_roles: ['DOSIFICADOR'] },
      },
      actor('DOSIFICADOR', ['plant-2']),
      null,
      plantAsset
    )
    assert.equal(visible, false)
  })

  it('shows unit schedules to MECANICO when role is in executor_roles', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: unitAsset.id,
        checklists: { executor_roles: ['MECANICO'] },
      },
      actor('MECANICO'),
      null,
      unitAsset
    )
    assert.equal(visible, true)
  })

  it('requires operator assignment for OPERADOR on unit assets', () => {
    const schedule = {
      asset_id: unitAsset.id,
      checklists: { executor_roles: ['OPERADOR'] },
    }
    assert.equal(
      isScheduleVisibleToActor(
        schedule,
        actor('OPERADOR'),
        null,
        unitAsset,
        new Set(['asset-other'])
      ),
      false
    )
    assert.equal(
      isScheduleVisibleToActor(
        schedule,
        actor('OPERADOR'),
        null,
        unitAsset,
        new Set([unitAsset.id])
      ),
      true
    )
  })

  it('hides OPERADOR schedules when OPERADOR not in executor_roles', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: unitAsset.id,
        checklists: { executor_roles: ['MECANICO'] },
      },
      actor('OPERADOR'),
      null,
      unitAsset,
      new Set([unitAsset.id])
    )
    assert.equal(visible, false)
  })

  it('shows unit schedules to GERENCIA_GENERAL (supervisory list access)', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: unitAsset.id,
        checklists: { executor_roles: ['MECANICO'] },
      },
      actor('GERENCIA_GENERAL'),
      null,
      unitAsset
    )
    assert.equal(visible, true)
  })

  it('shows PLANTA schedules to GERENCIA_GENERAL (supervisory list access)', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: plantAsset.id,
        checklists: { executor_roles: ['DOSIFICADOR', 'JEFE_PLANTA'] },
      },
      actor('GERENCIA_GENERAL'),
      null,
      plantAsset
    )
    assert.equal(visible, true)
  })

  it('shows PLANTA schedules to RECURSOS_HUMANOS', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: plantAsset.id,
        checklists: { executor_roles: ['DOSIFICADOR', 'JEFE_PLANTA'] },
      },
      actor('RECURSOS_HUMANOS'),
      null,
      plantAsset
    )
    assert.equal(visible, true)
  })

  it('shows PLANTA schedules to COORDINADOR_MANTENIMIENTO (read-only list)', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: plantAsset.id,
        checklists: { executor_roles: ['DOSIFICADOR', 'JEFE_PLANTA'] },
      },
      actor('COORDINADOR_MANTENIMIENTO'),
      null,
      plantAsset
    )
    assert.equal(visible, true)
  })

  it('allows COORDINADOR list view when asset join is missing', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: unitAsset.id,
        checklists: { executor_roles: null },
      },
      actor('COORDINADOR_MANTENIMIENTO'),
      null,
      null
    )
    assert.equal(visible, true)
  })

  it('shows unit schedules to COORDINADOR even when not in executor_roles', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: unitAsset.id,
        checklists: { executor_roles: ['MECANICO'] },
      },
      actor('COORDINADOR_MANTENIMIENTO'),
      null,
      unitAsset
    )
    assert.equal(visible, true)
  })

  it('shows unit schedules to ENCARGADO_MANTENIMIENTO (deprecated role)', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: unitAsset.id,
        checklists: { executor_roles: ['MECANICO'] },
      },
      actor('ENCARGADO_MANTENIMIENTO'),
      null,
      unitAsset
    )
    assert.equal(visible, true)
  })

  it('hides schedules from DOSIFICADOR when asset join is missing', () => {
    const visible = isScheduleVisibleToActor(
      {
        asset_id: unitAsset.id,
        checklists: { executor_roles: ['DOSIFICADOR'] },
      },
      actor('DOSIFICADOR', ['plant-1']),
      null,
      null
    )
    assert.equal(visible, false)
  })

  it('requires operator assignment when asset join is missing', () => {
    const schedule = {
      asset_id: unitAsset.id,
      checklists: { executor_roles: ['OPERADOR'] },
    }
    assert.equal(
      isScheduleVisibleToActor(schedule, actor('OPERADOR'), null, null, new Set()),
      false
    )
    assert.equal(
      isScheduleVisibleToActor(
        schedule,
        actor('OPERADOR'),
        null,
        null,
        new Set([unitAsset.id])
      ),
      true
    )
  })
})

describe('isAssetVisibleToActor', () => {
  it('hides PLANTA assets from field roles without plant scope', () => {
    assert.equal(isAssetVisibleToActor(plantAsset, actor('MECANICO')), false)
    assert.equal(
      isAssetVisibleToActor(plantAsset, actor('DOSIFICADOR', ['plant-1'])),
      true
    )
  })

  it('shows PLANTA assets to GERENCIA_GENERAL and RECURSOS_HUMANOS', () => {
    assert.equal(
      isAssetVisibleToActor(plantAsset, actor('GERENCIA_GENERAL')),
      true
    )
    assert.equal(
      isAssetVisibleToActor(plantAsset, actor('RECURSOS_HUMANOS')),
      true
    )
  })

  it('shows PLANTA assets to COORDINADOR_MANTENIMIENTO (read-only list)', () => {
    assert.equal(
      isAssetVisibleToActor(plantAsset, actor('COORDINADOR_MANTENIMIENTO')),
      true
    )
  })

  it('shows assigned unit assets to OPERADOR only', () => {
    assert.equal(
      isAssetVisibleToActor(unitAsset, actor('OPERADOR'), new Set([unitAsset.id])),
      true
    )
    assert.equal(
      isAssetVisibleToActor(unitAsset, actor('OPERADOR'), new Set()),
      false
    )
  })

  it('shows unit assets to COORDINADOR and GERENTE_MANTENIMIENTO', () => {
    assert.equal(
      isAssetVisibleToActor(unitAsset, actor('COORDINADOR_MANTENIMIENTO')),
      true
    )
    assert.equal(
      isAssetVisibleToActor(unitAsset, actor('GERENTE_MANTENIMIENTO')),
      true
    )
  })
})
