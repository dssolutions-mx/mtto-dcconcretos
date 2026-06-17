import test from "node:test"
import assert from "node:assert/strict"

import {
  flattenCotizadorOrders,
  isPumpProductType,
  orderItemHasPumpService,
  summarizeOrderPump,
} from "./cotizador-orders"
import {
  consolidateKitLines,
  extractPartsFromWorkOrder,
} from "./aggregate-daily-kit"

test("orderItemHasPumpService uses has_pump_service on concrete recipes", () => {
  assert.equal(
    orderItemHasPumpService({
      product_type: "6-300-2-C-28-14-B",
      has_pump_service: true,
    }),
    true,
  )
  assert.equal(
    orderItemHasPumpService({
      product_type: "5-150-2-B-28-10-D",
      has_pump_service: false,
    }),
    false,
  )
})

test("isPumpProductType detects standalone bombeo service lines", () => {
  assert.equal(isPumpProductType("SERVICIO DE BOMBEO"), true)
  assert.equal(isPumpProductType("Concreto FC=250"), false)
  assert.equal(isPumpProductType(null), false)
})

test("summarizeOrderPump aggregates pump_volume from order items", () => {
  const summary = summarizeOrderPump([
    { product_type: "5-250-2-B-28-14-B", volume: 25, has_pump_service: true },
    {
      product_type: "SERVICIO DE BOMBEO",
      volume: 25,
      pump_volume: 25,
      has_pump_service: true,
    },
  ])

  assert.equal(summary.hasPumpingService, true)
  assert.equal(summary.pumpVolumePlanned, 25)
  assert.equal(summary.hasConcreteLine, true)
  assert.equal(summary.isPumpOnly, false)
})

test("flattenCotizadorOrders surfaces concrete lines with has_pump_service", () => {
  const rows = flattenCotizadorOrders([
    {
      id: "o2",
      order_number: "ORD-101",
      delivery_date: "2026-06-16",
      plant_id: "p1",
      order_status: "validated",
      order_items: [
        { product_type: "6-300-2-C-28-14-B", volume: 39, has_pump_service: true },
        {
          product_type: "SERVICIO DE BOMBEO",
          volume: 39,
          pump_volume: 39,
          has_pump_service: true,
        },
      ],
    },
    {
      id: "o3",
      order_number: "ORD-102",
      delivery_date: "2026-06-16",
      plant_id: "p1",
      order_status: "created",
      order_items: [{ product_type: "5-150-2-B-28-10-D", volume: 7, has_pump_service: false }],
    },
  ])

  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.order_number, "ORD-101")
  assert.equal(rows[0]?.product_type, "6-300-2-C-28-14-B")
  assert.equal(rows[0]?.has_pumping_service, true)
  assert.equal(rows[0]?.pump_volume_planned, 39)
  assert.equal(rows[0]?.is_pump_only, false)
  assert.equal(rows[1]?.has_pumping_service, false)
})

test("flattenCotizadorOrders includes pump-only orders for machine planning", () => {
  const rows = flattenCotizadorOrders([
    {
      id: "o1",
      order_number: "ORD-100",
      delivery_date: "2026-06-16",
      plant_id: "p1",
      order_status: "created",
      order_items: [
        {
          product_type: "SERVICIO DE BOMBEO",
          volume: 30,
          pump_volume: 30,
          has_pump_service: true,
        },
      ],
    },
  ])

  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.is_pump_only, true)
  assert.equal(rows[0]?.has_pumping_service, true)
  assert.equal(rows[0]?.pump_volume_planned, 30)
})

test("flattenCotizadorOrders can include bombeo line items when requested", () => {
  const rows = flattenCotizadorOrders(
    [
      {
        id: "o2",
        order_number: "ORD-101",
        delivery_date: "2026-06-16",
        plant_id: "p1",
        order_status: "validated",
        order_items: [
          { product_type: "5-250-2-B-28-14-B", volume: 12, has_pump_service: true },
          {
            product_type: "SERVICIO DE BOMBEO",
            volume: 12,
            pump_volume: 12,
            has_pump_service: true,
          },
        ],
      },
    ],
    { includePumpLines: true },
  )

  assert.equal(rows.length, 2)
  assert.equal(rows.some((r) => r.is_pump_only), true)
  assert.equal(rows.find((r) => !r.is_pump_only)?.has_pumping_service, true)
  assert.equal(rows.find((r) => !r.is_pump_only)?.pump_volume_planned, 12)
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
