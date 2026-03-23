import test from "node:test"
import assert from "node:assert/strict"

import {
  buildIngresosGastosResponseFromRollup,
  type KpiRollupPlant,
} from "./ingresos-gastos-kpi-rollup"

const plants: KpiRollupPlant[] = [
  { id: "p1", name: "Plant 1", code: "P001", business_unit_id: "bu-a" },
  { id: "p2", name: "Plant 2", code: "P002", business_unit_id: "bu-a" },
]

test("builds current-only filtered response from rollup rows", () => {
  const result = buildIngresosGastosResponseFromRollup({
    month: "2026-03",
    comparisonMonth: null,
    targetPlants: plants,
    businessUnits: [{ id: "bu-a", name: "BU A", code: "A" }],
    plants,
    currentPlants: [
      {
        plant_id: "p1",
        plant_code: "P001",
        plant_name: "Plant 1",
        business_unit_id: "bu-a",
        ventas_total: 0,
        diesel_total: 150,
        mantto_total: 300,
        nomina_total: 0,
        otros_indirectos_total: 0,
      },
      {
        plant_id: "p2",
        plant_code: "P002",
        plant_name: "Plant 2",
        business_unit_id: "bu-a",
        ventas_total: 0,
        diesel_total: 0,
        mantto_total: 0,
        nomina_total: 0,
        otros_indirectos_total: 0,
      },
    ],
    previousPlants: [],
    skipPreviousMonth: true,
  })

  assert.equal(result.month, "2026-03")
  assert.equal(result.comparisonMonth, null)
  assert.equal(result.plants.length, 1)
  assert.equal(result.plants[0]?.plant_id, "p1")
  assert.deepEqual(result.comparison, { month: null, plants: [] })
  assert.deepEqual(result.deltas, {})
})

test("builds current-vs-previous comparison and deltas from rollup rows", () => {
  const result = buildIngresosGastosResponseFromRollup({
    month: "2026-03",
    comparisonMonth: "2026-02",
    targetPlants: plants,
    businessUnits: [{ id: "bu-a", name: "BU A", code: "A" }],
    plants,
    currentPlants: [
      {
        plant_id: "p1",
        plant_code: "P001",
        plant_name: "Plant 1",
        business_unit_id: "bu-a",
        ventas_total: 1000,
        diesel_total: 200,
        diesel_unitario: 20,
        diesel_pct: 20,
        mantto_total: 300,
        total_costo_op: 500,
        ebitda: 200,
        otros_indirectos_total: 0,
        nomina_total: 0,
        volumen_concreto: 10,
      },
    ],
    previousPlants: [
      {
        plant_id: "p1",
        plant_code: "P001",
        plant_name: "Plant 1",
        business_unit_id: "bu-a",
        ventas_total: 800,
        diesel_total: 150,
        diesel_unitario: 15,
        diesel_pct: 18.75,
        mantto_total: 250,
        total_costo_op: 400,
        ebitda: 150,
        otros_indirectos_total: 0,
        nomina_total: 0,
        volumen_concreto: 8,
      },
    ],
    skipPreviousMonth: false,
  })

  assert.equal(result.comparisonMonth, "2026-02")
  assert.equal(result.plants.length, 1)
  assert.equal(result.comparison.plants.length, 1)
  assert.deepEqual(result.deltas["P001"]?.diesel_total, {
    current: 200,
    previous: 150,
    delta: 50,
    deltaPct: 33.33333333333333,
  })
  assert.deepEqual(result.deltas["P001"]?.mantto_total, {
    current: 300,
    previous: 250,
    delta: 50,
    deltaPct: 20,
  })
})

test("normalizes full snapshots to costs-only response semantics", () => {
  const result = buildIngresosGastosResponseFromRollup({
    month: "2026-03",
    comparisonMonth: null,
    targetPlants: plants,
    businessUnits: [{ id: "bu-a", name: "BU A", code: "A" }],
    plants,
    currentPlants: [
      {
        plant_id: "p1",
        plant_code: "P001",
        plant_name: "Plant 1",
        business_unit_id: "bu-a",
        ventas_total: 1000,
        volumen_concreto: 50,
        diesel_total: 150,
        mantto_total: 300,
        nomina_total: 40,
        otros_indirectos_total: 10,
        ebitda: 500,
      },
      {
        plant_id: "p2",
        plant_code: "P002",
        plant_name: "Plant 2",
        business_unit_id: "bu-a",
        ventas_total: 2500,
        volumen_concreto: 75,
        diesel_total: 0,
        mantto_total: 0,
        nomina_total: 0,
        otros_indirectos_total: 0,
        ebitda: 900,
      },
    ],
    previousPlants: [],
    skipPreviousMonth: true,
    costsOnly: true,
  })

  assert.equal(result.plants.length, 1)
  assert.deepEqual(result.plants[0], {
    plant_id: "p1",
    plant_code: "P001",
    plant_name: "Plant 1",
    business_unit_id: "bu-a",
    ventas_total: 0,
    volumen_concreto: 0,
    fc_ponderada: 0,
    edad_ponderada: 0,
    pv_unitario: 0,
    costo_mp_unitario: 0,
    consumo_cem_m3: 0,
    costo_cem_m3: 0,
    costo_cem_pct: 0,
    costo_mp_total: 0,
    costo_mp_pct: 0,
    spread_unitario: 0,
    spread_unitario_pct: 0,
    diesel_total: 150,
    diesel_unitario: 0,
    diesel_pct: 0,
    mantto_total: 300,
    mantto_unitario: 0,
    mantto_pct: 0,
    nomina_total: 0,
    nomina_unitario: 0,
    nomina_pct: 0,
    otros_indirectos_total: 0,
    otros_indirectos_unitario: 0,
    otros_indirectos_pct: 0,
    total_costo_op: 450,
    total_costo_op_pct: 0,
    ebitda: -450,
    ebitda_pct: 0,
    ingresos_bombeo_vol: 0,
    ingresos_bombeo_unit: 0,
    ingresos_bombeo_total: 0,
    ebitda_con_bombeo: -450,
    ebitda_con_bombeo_pct: 0,
  })
})
