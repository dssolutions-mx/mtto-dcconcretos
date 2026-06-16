import test from "node:test"
import assert from "node:assert/strict"

import { AGENDA_ACTIVE_STATUSES } from "./agenda-utils"
import { WorkOrderStatus } from "@/types"

const SCHEDULABLE_STATUSES = new Set<string>(AGENDA_ACTIVE_STATUSES)

test("AGENDA_ACTIVE_STATUSES includes mechanic execution statuses", () => {
  assert.ok(SCHEDULABLE_STATUSES.has("En ejecución"))
  assert.ok(SCHEDULABLE_STATUSES.has("En Progreso"))
  assert.ok(SCHEDULABLE_STATUSES.has(WorkOrderStatus.Programmed))
})

test("schedule PATCH rejects completion statuses", () => {
  assert.equal(SCHEDULABLE_STATUSES.has(WorkOrderStatus.Completed), false)
  assert.equal(SCHEDULABLE_STATUSES.has("Completado"), false)
  assert.equal(SCHEDULABLE_STATUSES.has("Cancelado"), false)
})
