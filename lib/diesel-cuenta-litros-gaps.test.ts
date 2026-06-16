import test from "node:test"
import assert from "node:assert/strict"

import {
  buildCuentaLitrosGaps,
  buildGapNarrative,
  formatTimeWindow,
  getSignificantGaps,
  indexGapsByTransactionId,
  sumUnregisteredLiters,
  type GapTransactionInput,
} from "./diesel-cuenta-litros-gaps"

const WAREHOUSE_ID = "wh-1"

function tx(
  overrides: Partial<GapTransactionInput> & Pick<GapTransactionInput, "id" | "transaction_id">,
): GapTransactionInput {
  return {
    transaction_type: "consumption",
    quantity_liters: 0,
    transaction_date: "2026-06-01T10:00:00.000Z",
    created_at: "2026-06-01T10:00:00.000Z",
    cuenta_litros: null,
    is_transfer: false,
    notes: null,
    asset_name: null,
    asset_id: null,
    exception_asset_name: null,
    ...overrides,
  }
}

test("buildCuentaLitrosGaps detects unregistered dispense between anchors A and B", () => {
  const transactions = [
    tx({
      id: "a",
      transaction_id: "TX-A",
      quantity_liters: 100,
      cuenta_litros: 100,
      transaction_date: "2026-06-01T08:00:00.000Z",
    }),
    tx({
      id: "b",
      transaction_id: "TX-B",
      quantity_liters: 50,
      cuenta_litros: 200,
      transaction_date: "2026-06-01T14:15:00.000Z",
    }),
  ]

  const gaps = buildCuentaLitrosGaps(transactions, {
    warehouse_id: WAREHOUSE_ID,
    has_cuenta_litros: true,
  })

  assert.equal(gaps.length, 1)
  const gap = gaps[0]!
  assert.equal(gap.meter_delta, 100)
  assert.equal(gap.registered_liters, 50)
  assert.equal(gap.gap_liters, 50)
  assert.equal(gap.gap_type, "unregistered_dispense")
  assert.equal(gap.short_label, "Salida faltante +50L")
  assert.deepEqual(gap.transaction_ids_in_interval, ["b"])
  assert.match(gap.narrative, /salida faltante de ~50 L/i)
  assert.match(gap.narrative, /TX-A/)
  assert.match(gap.narrative, /TX-B/)
})

test("buildCuentaLitrosGaps sums intermediate consumption without cuenta_litros", () => {
  const transactions = [
    tx({
      id: "a",
      transaction_id: "TX-A",
      quantity_liters: 100,
      cuenta_litros: 100,
      transaction_date: "2026-06-01T08:00:00.000Z",
    }),
    tx({
      id: "mid",
      transaction_id: "TX-MID",
      quantity_liters: 30,
      cuenta_litros: null,
      transaction_date: "2026-06-01T10:00:00.000Z",
    }),
    tx({
      id: "b",
      transaction_id: "TX-B",
      quantity_liters: 20,
      cuenta_litros: 150,
      transaction_date: "2026-06-01T12:00:00.000Z",
    }),
  ]

  const gaps = buildCuentaLitrosGaps(transactions, {
    warehouse_id: WAREHOUSE_ID,
    has_cuenta_litros: true,
  })

  assert.equal(gaps.length, 1)
  assert.equal(gaps[0]!.registered_liters, 50)
  assert.equal(gaps[0]!.meter_delta, 50)
  assert.equal(gaps[0]!.gap_liters, 0)
  assert.equal(gaps[0]!.gap_type, "within_tolerance")
  assert.deepEqual(gaps[0]!.transaction_ids_in_interval, ["mid", "b"])
})

test("buildCuentaLitrosGaps excludes transfers and adjustments from registered sum", () => {
  const transactions = [
    tx({
      id: "a",
      transaction_id: "TX-A",
      quantity_liters: 10,
      cuenta_litros: 100,
      transaction_date: "2026-06-01T08:00:00.000Z",
    }),
    tx({
      id: "transfer",
      transaction_id: "TX-T",
      quantity_liters: 40,
      is_transfer: true,
      transaction_date: "2026-06-01T09:00:00.000Z",
    }),
    tx({
      id: "adj",
      transaction_id: "TX-ADJ",
      quantity_liters: 25,
      notes: "[AJUSTE -] corrección",
      transaction_date: "2026-06-01T09:30:00.000Z",
    }),
    tx({
      id: "b",
      transaction_id: "TX-B",
      quantity_liters: 10,
      cuenta_litros: 160,
      transaction_date: "2026-06-01T10:00:00.000Z",
    }),
  ]

  const gaps = buildCuentaLitrosGaps(transactions, {
    warehouse_id: WAREHOUSE_ID,
    has_cuenta_litros: true,
  })

  assert.equal(gaps[0]!.registered_liters, 10)
  assert.equal(gaps[0]!.meter_delta, 60)
  assert.equal(gaps[0]!.gap_liters, 50)
  assert.equal(gaps[0]!.gap_type, "unregistered_dispense")
})

test("buildCuentaLitrosGaps returns empty for warehouse without meter", () => {
  const gaps = buildCuentaLitrosGaps(
    [
      tx({
        id: "a",
        transaction_id: "TX-A",
        quantity_liters: 50,
        cuenta_litros: 100,
      }),
    ],
    { warehouse_id: WAREHOUSE_ID, has_cuenta_litros: false },
  )

  assert.deepEqual(gaps, [])
})

test("formatTimeWindow renders Spanish duration labels", () => {
  const sixHoursFifteen = (6 * 60 + 15) * 60_000
  assert.equal(formatTimeWindow(sixHoursFifteen), "6 h 15 min")
  assert.equal(formatTimeWindow(45 * 60_000), "45 min")
})

test("indexGapsByTransactionId maps anchors and interval transactions", () => {
  const transactions = [
    tx({
      id: "a",
      transaction_id: "TX-A",
      quantity_liters: 100,
      cuenta_litros: 100,
      transaction_date: "2026-06-01T08:00:00.000Z",
    }),
    tx({
      id: "mid",
      transaction_id: "TX-MID",
      quantity_liters: 10,
      transaction_date: "2026-06-01T09:00:00.000Z",
    }),
    tx({
      id: "b",
      transaction_id: "TX-B",
      quantity_liters: 50,
      cuenta_litros: 200,
      transaction_date: "2026-06-01T10:00:00.000Z",
    }),
  ]

  const gaps = buildCuentaLitrosGaps(transactions, {
    warehouse_id: WAREHOUSE_ID,
    has_cuenta_litros: true,
  })
  const index = indexGapsByTransactionId(gaps)

  assert.equal(index.get("a")?.id, gaps[0]!.id)
  assert.equal(index.get("mid")?.id, gaps[0]!.id)
  assert.equal(index.get("b")?.id, gaps[0]!.id)
})

test("sumUnregisteredLiters and getSignificantGaps filter actionable gaps", () => {
  const transactions = [
    tx({
      id: "a1",
      transaction_id: "TX-A1",
      quantity_liters: 10,
      cuenta_litros: 100,
      transaction_date: "2026-06-01T08:00:00.000Z",
    }),
    tx({
      id: "b1",
      transaction_id: "TX-B1",
      quantity_liters: 5,
      cuenta_litros: 120,
      transaction_date: "2026-06-01T09:00:00.000Z",
    }),
    tx({
      id: "a2",
      transaction_id: "TX-A2",
      quantity_liters: 1,
      cuenta_litros: 120,
      transaction_date: "2026-06-01T10:00:00.000Z",
    }),
    tx({
      id: "b2",
      transaction_id: "TX-B2",
      quantity_liters: 1,
      cuenta_litros: 122,
      transaction_date: "2026-06-01T11:00:00.000Z",
    }),
  ]

  const gaps = buildCuentaLitrosGaps(transactions, {
    warehouse_id: WAREHOUSE_ID,
    has_cuenta_litros: true,
  })

  assert.equal(getSignificantGaps(gaps).length, 1)
  assert.equal(sumUnregisteredLiters(gaps), 15)
})

test("buildGapNarrative describes over-registration", () => {
  const narrative = buildGapNarrative({
    gap_type: "over_registered",
    gap_liters: -30,
    meter_delta: 20,
    registered_liters: 50,
    time_window_label: "2 h",
    prev_anchor: {
      tx_id: "a",
      transaction_id: "TX-A",
      transaction_date: "2026-06-01T08:00:00.000Z",
      quantity_liters: 10,
      cuenta_litros: 100,
      asset_label: null,
    },
    curr_anchor: {
      tx_id: "b",
      transaction_id: "TX-B",
      transaction_date: "2026-06-01T10:00:00.000Z",
      quantity_liters: 50,
      cuenta_litros: 120,
      asset_label: null,
    },
  })

  assert.match(narrative, /sobre-registro/i)
})
