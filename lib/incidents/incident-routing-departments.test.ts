import { describe, expect, it } from "vitest"
import {
  matchDepartmentToCanonical,
  resolveCanonicalRoutingDepartments,
} from "./incident-routing-departments"

describe("incident-routing-departments", () => {
  it("maps known department codes to canonical buckets", () => {
    expect(matchDepartmentToCanonical({ name: "Mantenimiento Planta 1", code: "MANT" })).toBe(
      "mantenimiento",
    )
    expect(matchDepartmentToCanonical({ name: "Operaciones", code: "OPER" })).toBe("operaciones")
    expect(matchDepartmentToCanonical({ name: "Recursos Humanos", code: "RH" })).toBe(
      "recursos_humanos",
    )
    expect(matchDepartmentToCanonical({ name: "Calidad", code: "CAL" })).toBe("calidad")
  })

  it("resolves primary ids per canonical department", () => {
    const resolved = resolveCanonicalRoutingDepartments([
      { id: "d1", name: "Mantenimiento", code: "MANT", plant_id: "p1" },
      { id: "d2", name: "Operaciones", code: "OPER", plant_id: "p1" },
      { id: "d3", name: "RH", code: "RH", plant_id: "p1" },
      { id: "d4", name: "Calidad", code: "CAL", plant_id: "p1" },
      { id: "d5", name: "Contabilidad", code: "CONT", plant_id: "p1" },
    ])

    expect(resolved.find((r) => r.slug === "mantenimiento")?.primaryDepartmentId).toBe("d1")
    expect(resolved.find((r) => r.slug === "operaciones")?.primaryDepartmentId).toBe("d2")
    expect(resolved.find((r) => r.slug === "calidad")?.departmentIds).toEqual(["d4"])
  })
})
