import test from "node:test"
import assert from "node:assert/strict"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { ActorContext } from "./server-authorization"
import {
  assertActorMayMutateAssetOperator,
  assertMayMutateAssetOperatorRow,
  assertMayTransferAssetOperator,
  canAttemptAssetOperatorMutation,
  canManageAssetOperatorsGlobally,
} from "./server-authorization"

function baseActor(overrides: Partial<ActorContext["profile"]> & { userId?: string }): ActorContext {
  const userId = overrides.userId ?? "actor-1"
  const plantId = overrides.plant_id ?? null
  const managed =
    overrides.managed_plant_ids ??
    (plantId ? [plantId] : [] as string[])
  return {
    userId,
    profile: {
      id: userId,
      role: overrides.role ?? "JEFE_UNIDAD_NEGOCIO",
      business_role: null,
      role_scope: null,
      business_unit_id: overrides.business_unit_id ?? "bu-a",
      plant_id: plantId,
      managed_plant_ids: managed,
      can_authorize_up_to: 0,
    },
    effectiveBusinessRole: "JEFE_UNIDAD_NEGOCIO",
    scope: "business_unit",
    authorizationLimit: 0,
  }
}

function mockSupabase(config: {
  plantRows: { id: string }[]
  assetsById: Record<
    string,
    { plant_id: string | null; plants?: { business_unit_id: string } | null }
  >
  operatorById: Record<string, { id: string; plant_id: string | null; business_unit_id: string | null }>
}): SupabaseClient {
  return {
    from(table: string) {
      if (table === "plants") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: config.plantRows, error: null }),
          }),
        }
      }
      if (table === "assets") {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: config.assetsById[val] ?? null,
                  error: null,
                }),
            }),
          }),
        }
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: config.operatorById[val] ?? null,
                  error: null,
                }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as SupabaseClient
}

test("canManageAssetOperatorsGlobally includes RH path and GERENTE_MANTENIMIENTO", () => {
  assert.equal(
    canManageAssetOperatorsGlobally(
      baseActor({ role: "GERENCIA_GENERAL", business_unit_id: null })
    ),
    true
  )
  assert.equal(
    canManageAssetOperatorsGlobally(
      baseActor({ role: "GERENTE_MANTENIMIENTO", business_unit_id: null })
    ),
    true
  )
  assert.equal(
    canManageAssetOperatorsGlobally(
      baseActor({ role: "JEFE_UNIDAD_NEGOCIO", business_unit_id: "bu-a" })
    ),
    false
  )
})

test("canAttemptAssetOperatorMutation allows JUN and JP", () => {
  assert.equal(
    canAttemptAssetOperatorMutation(
      baseActor({ role: "JEFE_UNIDAD_NEGOCIO", business_unit_id: "bu-a" })
    ),
    true
  )
  assert.equal(
    canAttemptAssetOperatorMutation(
      baseActor({
        role: "JEFE_PLANTA",
        business_unit_id: "bu-a",
        plant_id: "p1",
      })
    ),
    true
  )
  assert.equal(
    canAttemptAssetOperatorMutation(
      baseActor({ role: "COORDINADOR_MANTENIMIENTO", plant_id: "p1" })
    ),
    false
  )
})

test("assertActorMayMutateAssetOperator allows JUN when asset and operator are in BU", async () => {
  const supabase = mockSupabase({
    plantRows: [{ id: "p1" }],
    assetsById: {
      "asset-1": {
        plant_id: "p1",
        plants: { business_unit_id: "bu-a" },
      },
    },
    operatorById: {
      "op-1": { id: "op-1", plant_id: "p1", business_unit_id: "bu-a" },
    },
  })
  const actor = baseActor({ business_unit_id: "bu-a" })
  const r = await assertActorMayMutateAssetOperator(supabase, actor, {
    assetId: "asset-1",
    operatorId: "op-1",
  })
  assert.equal(r.ok, true)
})

test("assertActorMayMutateAssetOperator rejects JUN when asset plant BU differs", async () => {
  const supabase = mockSupabase({
    plantRows: [{ id: "p1" }],
    assetsById: {
      "asset-1": {
        plant_id: "p1",
        plants: { business_unit_id: "bu-other" },
      },
    },
    operatorById: {
      "op-1": { id: "op-1", plant_id: "p1", business_unit_id: "bu-a" },
    },
  })
  const actor = baseActor({ business_unit_id: "bu-a" })
  const r = await assertActorMayMutateAssetOperator(supabase, actor, {
    assetId: "asset-1",
    operatorId: "op-1",
  })
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.status, 403)
  }
})

test("assertActorMayMutateAssetOperator rejects JP when operator is on another plant", async () => {
  const supabase = mockSupabase({
    plantRows: [{ id: "p1" }],
    assetsById: {
      "asset-1": { plant_id: "p1", plants: { business_unit_id: "bu-a" } },
    },
    operatorById: {
      "op-1": { id: "op-1", plant_id: "p2", business_unit_id: null },
    },
  })
  const actor = baseActor({
    role: "JEFE_PLANTA",
    business_unit_id: "bu-a",
    plant_id: "p1",
  })
  actor.effectiveBusinessRole = "JEFE_PLANTA"
  actor.scope = "plant"
  const r = await assertActorMayMutateAssetOperator(supabase, actor, {
    assetId: "asset-1",
    operatorId: "op-1",
  })
  assert.equal(r.ok, false)
})

test("assertActorMayMutateAssetOperator allows two-plant JP on second managed plant", async () => {
  const supabase = mockSupabase({
    plantRows: [{ id: "p2" }],
    assetsById: {
      "asset-1": { plant_id: "p2" },
    },
    operatorById: {
      "op-1": { id: "op-1", plant_id: "p2" },
    },
  })
  const actor = baseActor({
    role: "JEFE_PLANTA",
    business_unit_id: "bu-a",
    plant_id: "p1",
    managed_plant_ids: ["p1", "p2"],
  })
  actor.effectiveBusinessRole = "JEFE_PLANTA"
  actor.scope = "plant"
  const r = await assertActorMayMutateAssetOperator(supabase, actor, {
    assetId: "asset-1",
    operatorId: "op-1",
  })
  assert.equal(r.ok, true)
})

test("assertMayMutateAssetOperatorRow returns 401 when actor is null", async () => {
  const supabase = mockSupabase({
    plantRows: [],
    assetsById: {},
    operatorById: {},
  })
  const r = await assertMayMutateAssetOperatorRow(supabase, null, {
    assetId: "a",
    operatorId: "o",
  })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.status, 401)
})

test("assertMayTransferAssetOperator checks both assets when fromAssetId set", async () => {
  const supabase = mockSupabase({
    plantRows: [{ id: "p1" }],
    assetsById: {
      "to-a": { plant_id: "p1", plants: { business_unit_id: "bu-a" } },
      "from-a": { plant_id: "p1", plants: { business_unit_id: "bu-a" } },
    },
    operatorById: {
      "op-1": { id: "op-1", plant_id: "p1", business_unit_id: "bu-a" },
    },
  })
  const actor = baseActor({ business_unit_id: "bu-a" })
  const r = await assertMayTransferAssetOperator(supabase, actor, {
    operatorId: "op-1",
    toAssetId: "to-a",
    fromAssetId: "from-a",
  })
  assert.equal(r.ok, true)
})
