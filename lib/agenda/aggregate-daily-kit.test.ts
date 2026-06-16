import test from "node:test"
import assert from "node:assert/strict"

import {
  consolidateKitLines,
  plantPartAvailabilityKey,
} from "./aggregate-daily-kit"

function availability(partId: string, total: number) {
  return {
    part_id: partId,
    part_number: partId,
    part_name: partId,
    required_quantity: 0,
    total_available: total,
    sufficient: total > 0,
    available_by_warehouse: [],
  }
}

test("consolidateKitLines evaluates sufficiency per plant, not max across plants", () => {
  const availabilityMap = new Map([
    [plantPartAvailabilityKey("plant-a", "p1"), availability("p1", 5)],
    [plantPartAvailabilityKey("plant-b", "p1"), availability("p1", 20)],
  ])

  const kit = consolidateKitLines(
    [
      {
        part_id: "p1",
        plant_id: "plant-a",
        name: "Filtro",
        part_number: "F-1",
        quantity: 10,
      },
      {
        part_id: "p1",
        plant_id: "plant-b",
        name: "Filtro",
        part_number: "F-1",
        quantity: 10,
      },
    ],
    availabilityMap,
  )

  assert.equal(kit.length, 2)
  const plantA = kit.find((line) => line.key.includes("plant-a"))
  const plantB = kit.find((line) => line.key.includes("plant-b"))
  assert.equal(plantA?.sufficient, false)
  assert.equal(plantA?.total_available, 5)
  assert.equal(plantB?.sufficient, true)
  assert.equal(plantB?.total_available, 20)
})

test("consolidateKitLines sums quantities within the same plant", () => {
  const availabilityMap = new Map([
    [plantPartAvailabilityKey("plant-a", "p1"), availability("p1", 8)],
  ])

  const kit = consolidateKitLines(
    [
      { part_id: "p1", plant_id: "plant-a", name: "Filtro", quantity: 3 },
      { part_id: "p1", plant_id: "plant-a", name: "Filtro", quantity: 4 },
    ],
    availabilityMap,
  )

  assert.equal(kit.length, 1)
  assert.equal(kit[0]?.required_quantity, 7)
  assert.equal(kit[0]?.sufficient, true)
})
