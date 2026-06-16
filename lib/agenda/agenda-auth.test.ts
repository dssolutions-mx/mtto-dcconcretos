import test from "node:test"
import assert from "node:assert/strict"

import {
  canAccessAgendaIntegrations,
  canQuickUpdateWorkOrderStatus,
  canViewCotizadorPlantMapping,
} from "./agenda-auth"

test("canQuickUpdateWorkOrderStatus allows coordinators and assigned mechanics", () => {
  assert.equal(canQuickUpdateWorkOrderStatus("COORDINADOR_MANTENIMIENTO", "u1", "u2"), true)
  assert.equal(canQuickUpdateWorkOrderStatus("MECANICO", "u1", "u1"), true)
  assert.equal(canQuickUpdateWorkOrderStatus("MECANICO", "u1", "u2"), false)
})

test("canAccessAgendaIntegrations covers planning and mechanic roles", () => {
  assert.equal(canAccessAgendaIntegrations("COORDINADOR_MANTENIMIENTO"), true)
  assert.equal(canAccessAgendaIntegrations("MECANICO"), true)
  assert.equal(canAccessAgendaIntegrations("VISUALIZADOR"), false)
})

test("plant mapping is restricted to global admin", () => {
  assert.equal(canViewCotizadorPlantMapping("GERENCIA_GENERAL"), true)
  assert.equal(canViewCotizadorPlantMapping("COORDINADOR_MANTENIMIENTO"), false)
})
