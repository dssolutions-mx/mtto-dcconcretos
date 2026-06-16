import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"
import type { RoutingRuleInput } from "@/lib/incidents/incident-routing"

const RULE_SELECT = `
  *,
  departments:target_department_id ( id, name, code ),
  plants:plant_id ( id, name, code )
`

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("incident_routing_rules")
      .select(RULE_SELECT)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error("GET routing rules error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RoutingRuleInput
    if (!body.name?.trim() || !body.target_department_id) {
      return NextResponse.json(
        { error: "name y target_department_id son obligatorios" },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from("incident_routing_rules")
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        priority: body.priority ?? 100,
        is_active: body.is_active ?? true,
        plant_id: body.plant_id || null,
        match_incident_type: body.match_incident_type?.trim() || null,
        match_impact: body.match_impact?.trim() || null,
        match_description_contains: body.match_description_contains?.trim() || null,
        target_department_id: body.target_department_id,
        default_assignee_id: body.default_assignee_id || null,
        target_response_hours: body.target_response_hours ?? 24,
        created_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .select(RULE_SELECT)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error("POST routing rules error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
