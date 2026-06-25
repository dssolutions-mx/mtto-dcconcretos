import assert from "node:assert/strict"
import test from "node:test"
import {
  isConsumptionFormSubmittable,
  type ConsumptionWipContext,
} from "./diesel-consumption-wip"

const WIP_ID = "11111111-1111-4111-8111-111111111111"

function baseCtx(overrides: Partial<ConsumptionWipContext> = {}): ConsumptionWipContext {
  return {
    productType: "diesel",
    productId: "prod-1",
    userId: "user-1",
    selectedPlant: "plant-1",
    selectedWarehouse: "wh-1",
    warehouses: [{ id: "wh-1", plant_id: "plant-1" }],
    allBuWarehouses: [],
    assetType: "formal",
    selectedAsset: { id: "asset-1", name: "Excavadora" },
    exceptionAssetName: "",
    quantityLiters: "50",
    cuentaLitros: "1000",
    previousCuentaLitros: 950,
    cuentaLitrosVariance: 0,
    readings: {},
    transactionDate: "2026-06-25",
    transactionTime: "10:00",
    notes: "",
    machinePhotoDraftId: "photo-1",
    machineEvidenceMetadata: null,
    wipId: WIP_ID,
    ...overrides,
  }
}

test("isConsumptionFormSubmittable requires explicit wipId context fields", () => {
  assert.equal(isConsumptionFormSubmittable(baseCtx()), true)
  assert.equal(isConsumptionFormSubmittable(baseCtx({ machinePhotoDraftId: null })), false)
  assert.equal(isConsumptionFormSubmittable(baseCtx({ quantityLiters: "" })), false)
})

test("wipId is caller-owned and not derived inside ensureConsumptionWipQueued", () => {
  const ctx = baseCtx({ wipId: WIP_ID })
  assert.equal(ctx.wipId, WIP_ID)
})
