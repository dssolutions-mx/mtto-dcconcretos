import assert from 'node:assert/strict'

import { describe, it } from 'node:test'

import { PLANTA_MODEL_ID } from '@/lib/checklist/executor-roles'

import type { ActorContext } from '@/lib/auth/server-authorization'

import {

  assertCanCompleteChecklistSchedule,

  resolveScheduleAuthContext,

} from './executor-authorization'



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



const mockSupabase = {

  from: () => ({

    select: () => ({

      eq: () => ({

        eq: () => ({

          eq: () => ({

            limit: async () => ({ data: [], error: null }),

          }),

        }),

      }),

    }),

  }),

} as unknown as Parameters<typeof assertCanCompleteChecklistSchedule>[0]



describe('resolveScheduleAuthContext', () => {

  it('unwraps array-shaped Supabase joins', () => {

    const ctx = resolveScheduleAuthContext({

      asset_id: 'sched-asset',

      checklists: [

        {

          executor_roles: ['DOSIFICADOR', 'JEFE_PLANTA'],

          model_id: PLANTA_MODEL_ID,

          equipment_models: [{ maintenance_unit: 'none' }],

        },

      ],

      assets: [

        {

          id: 'asset-planta',

          plant_id: 'plant-1',

          model_id: PLANTA_MODEL_ID,

          equipment_models: [{ maintenance_unit: 'none' }],

        },

      ],

    })



    assert.equal(ctx.asset.assetId, 'sched-asset')

    assert.equal(ctx.asset.plantId, 'plant-1')

    assert.equal(ctx.asset.modelId, PLANTA_MODEL_ID)

    assert.equal(ctx.asset.maintenanceUnit, 'none')

    assert.deepEqual(ctx.executorRoles, ['DOSIFICADOR', 'JEFE_PLANTA'])

  })



  it('falls back to checklist model when asset model is missing', () => {

    const ctx = resolveScheduleAuthContext({

      asset_id: 'sched-asset',

      checklists: {

        executor_roles: ['DOSIFICADOR'],

        model_id: PLANTA_MODEL_ID,

        equipment_models: { maintenance_unit: 'none' },

      },

      assets: {

        id: 'asset-planta',

        plant_id: 'plant-1',

        model_id: null,

        equipment_models: null,

      },

    })



    assert.equal(ctx.asset.modelId, PLANTA_MODEL_ID)

    assert.equal(ctx.asset.maintenanceUnit, 'none')

  })

})



describe('assertCanCompleteChecklistSchedule PLANTA draft/complete parity', () => {

  it('allows DOSIFICADOR with plant scope when joins are array-shaped', async () => {

    const { executorRoles, asset } = resolveScheduleAuthContext({

      asset_id: 'asset-planta',

      checklists: [{ executor_roles: ['DOSIFICADOR', 'JEFE_PLANTA'] }],

      assets: [

        {

          id: 'asset-planta',

          plant_id: 'plant-1',

          model_id: PLANTA_MODEL_ID,

          equipment_models: [{ maintenance_unit: 'none' }],

        },

      ],

    })



    const result = await assertCanCompleteChecklistSchedule(

      mockSupabase,

      actor('DOSIFICADOR', ['plant-1']),

      executorRoles,

      asset

    )



    assert.deepEqual(result, { allowed: true })

  })



  it('allows JEFE_PLANTA with managed plant scope', async () => {

    const { executorRoles, asset } = resolveScheduleAuthContext({

      asset_id: 'asset-planta',

      checklists: [{ executor_roles: ['DOSIFICADOR', 'JEFE_PLANTA'] }],

      assets: [

        {

          id: 'asset-planta',

          plant_id: 'plant-2',

          model_id: PLANTA_MODEL_ID,

          equipment_models: [{ maintenance_unit: 'none' }],

        },

      ],

    })



    const result = await assertCanCompleteChecklistSchedule(

      mockSupabase,

      actor('JEFE_PLANTA', ['plant-1', 'plant-2']),

      executorRoles,

      asset

    )



    assert.deepEqual(result, { allowed: true })

  })



  it('denies DOSIFICADOR without plant scope on PLANTA asset', async () => {

    const { executorRoles, asset } = resolveScheduleAuthContext({

      asset_id: 'asset-planta',

      checklists: [{ executor_roles: ['DOSIFICADOR'] }],

      assets: [

        {

          id: 'asset-planta',

          plant_id: 'plant-1',

          model_id: PLANTA_MODEL_ID,

          equipment_models: [{ maintenance_unit: 'none' }],

        },

      ],

    })



    const result = await assertCanCompleteChecklistSchedule(

      mockSupabase,

      actor('DOSIFICADOR', ['plant-2']),

      executorRoles,

      asset

    )



    assert.equal(result.allowed, false)

    if (!result.allowed) {

      assert.match(result.reason, /alcance sobre la planta/)

    }

  })



  it('uses PLANTA executor preset even when template lists only OPERADOR', async () => {

    const { executorRoles, asset } = resolveScheduleAuthContext({

      asset_id: 'asset-planta',

      checklists: [{ executor_roles: ['OPERADOR'] }],

      assets: [

        {

          id: 'asset-planta',

          plant_id: 'plant-1',

          model_id: PLANTA_MODEL_ID,

          equipment_models: [{ maintenance_unit: 'none' }],

        },

      ],

    })



    const result = await assertCanCompleteChecklistSchedule(

      mockSupabase,

      actor('DOSIFICADOR', ['plant-1']),

      executorRoles,

      asset

    )



    assert.deepEqual(result, { allowed: true })

  })



  it('would fail without unwrapping array joins (regression guard)', async () => {

    const rawAsset = [

      {

        id: 'asset-planta',

        plant_id: 'plant-1',

        model_id: PLANTA_MODEL_ID,

        equipment_models: [{ maintenance_unit: 'none' }],

      },

    ] as unknown as {

      id?: string

      plant_id?: string | null

      model_id?: string | null

      equipment_models?: { maintenance_unit?: string | null } | null

    }



    const result = await assertCanCompleteChecklistSchedule(

      mockSupabase,

      actor('DOSIFICADOR', ['plant-1']),

      ['DOSIFICADOR', 'JEFE_PLANTA'],

      {

        assetId: 'asset-planta',

        plantId: rawAsset.plant_id ?? null,

        modelId: rawAsset.model_id ?? null,

        maintenanceUnit: rawAsset.equipment_models?.maintenance_unit ?? null,

      }

    )



    assert.equal(result.allowed, false)

  })



  it('allows GERENCIA_GENERAL on PLANTA without plant scope', async () => {

    const { executorRoles, asset } = resolveScheduleAuthContext({

      asset_id: 'asset-planta',

      checklists: [{ executor_roles: ['DOSIFICADOR', 'JEFE_PLANTA'] }],

      assets: [

        {

          id: 'asset-planta',

          plant_id: 'plant-1',

          model_id: PLANTA_MODEL_ID,

          equipment_models: [{ maintenance_unit: 'none' }],

        },

      ],

    })



    const result = await assertCanCompleteChecklistSchedule(

      mockSupabase,

      actor('GERENCIA_GENERAL', []),

      executorRoles,

      asset

    )



    assert.deepEqual(result, { allowed: true })

  })



  it('allows RECURSOS_HUMANOS on PLANTA without plant scope', async () => {

    const { executorRoles, asset } = resolveScheduleAuthContext({

      asset_id: 'asset-planta',

      checklists: [{ executor_roles: ['DOSIFICADOR', 'JEFE_PLANTA'] }],

      assets: [

        {

          id: 'asset-planta',

          plant_id: 'plant-1',

          model_id: PLANTA_MODEL_ID,

          equipment_models: [{ maintenance_unit: 'none' }],

        },

      ],

    })



    const result = await assertCanCompleteChecklistSchedule(

      mockSupabase,

      actor('RECURSOS_HUMANOS', []),

      executorRoles,

      asset

    )



    assert.deepEqual(result, { allowed: true })

  })



  it('denies OPERADOR on PLANTA asset', async () => {

    const { executorRoles, asset } = resolveScheduleAuthContext({

      asset_id: 'asset-planta',

      checklists: [{ executor_roles: ['DOSIFICADOR', 'JEFE_PLANTA'] }],

      assets: [

        {

          id: 'asset-planta',

          plant_id: 'plant-1',

          model_id: PLANTA_MODEL_ID,

          equipment_models: [{ maintenance_unit: 'none' }],

        },

      ],

    })



    const result = await assertCanCompleteChecklistSchedule(

      mockSupabase,

      actor('OPERADOR', ['plant-1']),

      executorRoles,

      asset

    )



    assert.equal(result.allowed, false)

    if (!result.allowed) {

      assert.match(result.reason, /no está autorizado/)

    }

  })



  it('denies MECANICO on PLANTA asset', async () => {

    const { executorRoles, asset } = resolveScheduleAuthContext({

      asset_id: 'asset-planta',

      checklists: [{ executor_roles: ['DOSIFICADOR', 'JEFE_PLANTA'] }],

      assets: [

        {

          id: 'asset-planta',

          plant_id: 'plant-1',

          model_id: PLANTA_MODEL_ID,

          equipment_models: [{ maintenance_unit: 'none' }],

        },

      ],

    })



    const result = await assertCanCompleteChecklistSchedule(

      mockSupabase,

      actor('MECANICO', []),

      executorRoles,

      asset

    )



    assert.equal(result.allowed, false)

    if (!result.allowed) {

      assert.match(result.reason, /no está autorizado/)

    }

  })

})

