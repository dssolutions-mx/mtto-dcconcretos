import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"
import { resolveCanonicalRoutingDepartments } from "@/lib/incidents/incident-routing-departments"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: departments, error } = await supabase
      .from("departments")
      .select("id, name, code, plant_id, plants(name, code)")
      .order("name")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const canonical = resolveCanonicalRoutingDepartments(departments ?? [])
    const unmatched = (departments ?? []).filter(
      (d) => !canonical.some((c) => c.departmentIds.includes(d.id)),
    )

    return NextResponse.json({
      canonical,
      unmatched,
      total_db_departments: departments?.length ?? 0,
      note:
        "El ruteo de incidentes usa solo Mantenimiento, Operaciones, Recursos Humanos y Calidad. Los departamentos sin coincidencia no aparecen en el pipeline.",
    })
  } catch (err) {
    console.error("GET routing departments error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
