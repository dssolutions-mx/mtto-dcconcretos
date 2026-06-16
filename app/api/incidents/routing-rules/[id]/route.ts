import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"
import type { RoutingRuleInput } from "@/lib/incidents/incident-routing"

const RULE_SELECT = `
  *,
  departments:target_department_id ( id, name, code ),
  plants:plant_id ( id, name, code )
`

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await req.json()) as Partial<RoutingRuleInput> & { is_active?: boolean }

    const supabase = await createClient()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.priority !== undefined) updates.priority = body.priority
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.plant_id !== undefined) updates.plant_id = body.plant_id || null
    if (body.match_incident_type !== undefined) {
      updates.match_incident_type = body.match_incident_type?.trim() || null
    }
    if (body.match_impact !== undefined) updates.match_impact = body.match_impact?.trim() || null
    if (body.match_description_contains !== undefined) {
      updates.match_description_contains = body.match_description_contains?.trim() || null
    }
    if (body.target_department_id !== undefined) {
      updates.target_department_id = body.target_department_id
    }
    if (body.default_assignee_id !== undefined) {
      updates.default_assignee_id = body.default_assignee_id || null
    }
    if (body.target_response_hours !== undefined) {
      updates.target_response_hours = body.target_response_hours
    }

    const { data, error } = await supabase
      .from("incident_routing_rules")
      .update(updates)
      .eq("id", id)
      .select(RULE_SELECT)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("PUT routing rule error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { error } = await supabase.from("incident_routing_rules").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("DELETE routing rule error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
