import test from "node:test"
import assert from "node:assert/strict"

import { flattenCotizadorOrders, isPumpProductType } from "./cotizador-orders"
import {
  consolidateKitLines,
  extractPartsFromWorkOrder,
} from "./aggregate-daily-kit"

test("isPumpProductType detects pump/bombeo lines", () => {
  assert.equal(isPumpProductType("Bombeo 42m"), true)
  assert.equal(isPumpProductType("pump service"), true)
  assert.equal(isPumpProductType("Concreto FC=250"), false)
  assert.equal(isPumpProductType(null), false)
})

test("flattenCotizadorOrders includes pump-only orders for machine planning", () => {
  const rows = flattenCotizadorOrders([
    {
      id: "o1",
      order_number: "100",
      delivery_date: "2026-06-16",
      plant_id: "p1",
      order_status: "created",
      order_items: [{ product_type: "Bombeo", volume: 30 }],
    },
    {
      id: "o2",
      order_number: "101",
      delivery_date: "2026-06-16",
      plant_id: "p1",
      order_status: "validated",
      order_items: [
        { product_type: "Concreto FC=250", volume: 12 },
        { product_type: "Bombeo", volume: 12 },
      ],
    },
  ])

  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.order_number, "100")
  assert.equal(rows[0]?.is_pump_only, true)
  assert.equal(rows[0]?.has_pumping_service, true)
  assert.equal(rows[1]?.order_number, "101")
  assert.equal(rows[1]?.product_type, "Concreto FC=250")
  assert.equal(rows[1]?.is_pump_only, false)
  assert.equal(rows[1]?.has_pumping_service, true)
})

test("flattenCotizadorOrders marks orders without pump service", () => {
  const rows = flattenCotizadorOrders([
    {
      id: "o3",
      order_number: "102",
      delivery_date: "2026-06-16",
      plant_id: "p1",
      order_status: "created",
      order_items: [{ product_type: "Concreto FC=250", volume: 8 }],
    },
  ])

  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.has_pumping_service, false)
})

test("flattenCotizadorOrders can include pump lines when requested", () => {
  const rows = flattenCotizadorOrders(
    [
      {
        id: "o2",
        order_number: "101",
        delivery_date: "2026-06-16",
        plant_id: "p1",
        order_status: "validated",
        order_items: [
          { product_type: "Concreto FC=250", volume: 12 },
          { product_type: "Bombeo", volume: 12 },
        ],
      },
    ],
    { includePumpLines: true },
  )

  assert.equal(rows.length, 2)
  assert.equal(rows.some((r) => r.is_pump_only), true)
  assert.equal(rows.find((r) => !r.is_pump_only)?.has_pumping_service, true)
})

test("extractPartsFromWorkOrder merges required_parts and task parts", () => {
  const lines = extractPartsFromWorkOrder({
    id: "wo1",
    order_id: "OT-1",
    asset_id: "a1",
    required_parts: [{ part_id: "p1", name: "Filtro", part_number: "F-1", quantity: 2 }],
    required_tasks: [
      {
        parts: [{ part_id: "p2", name: "Aceite", part_number: "A-1", quantity: 4 }],
      },
    ],
  })

  assert.equal(lines.length, 2)
  assert.deepEqual(
    lines.map((l) => l.part_id).sort(),
    ["p1", "p2"],
  )
})

test("consolidateKitLines sums quantities for the same part", () => {
  const kit = consolidateKitLines(
    [
      { part_id: "p1", name: "Filtro", part_number: "F-1", quantity: 2 },
      { part_id: "p1", name: "Filtro", part_number: "F-1", quantity: 3 },
    ],
    new Map([
      [
        "p1",
        {
          part_id: "p1",
          part_number: "F-1",
          part_name: "Filtro",
          required_quantity: 5,
          total_available: 10,
          sufficient: true,
          available_by_warehouse: [],
        },
      ],
    ]),
  )

  assert.equal(kit.length, 1)
  assert.equal(kit[0]?.required_quantity, 5)
  assert.equal(kit[0]?.sufficient, true)
})
