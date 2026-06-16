import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"
import {
  hoursSince,
  isOpenIncidentStatus,
  isSlaBreached,
  type IncidentPipelineStage,
} from "@/lib/incidents/incident-routing"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get("department_id")
    const assigneeId = searchParams.get("assignee_id")
    const stage = searchParams.get("stage")

    const supabase = await createClient()
    let query = supabase
      .from("incident_history")
      .select(`
        id,
        description,
        type,
        status,
        impact,
        date,
        created_at,
        asset_id,
        routing_department_id,
        assigned_to_id,
        pipeline_stage,
        target_response_hours,
        routed_at,
        assigned_at,
        assets ( id, name, asset_id ),
        departments:routing_department_id ( id, name, code )
      `)
      .in("status", ["Abierto", "Pendiente", "En progreso", "open", "pending", "in progress"])
      .order("routed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })

    if (departmentId) {
      query = query.eq("routing_department_id", departmentId)
    }
    if (assigneeId) {
      query = query.eq("assigned_to_id", assigneeId)
    }
    if (stage) {
      query = query.eq("pipeline_stage", stage)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const assigneeIds = [
      ...new Set((data ?? []).map((row) => row.assigned_to_id).filter(Boolean)),
    ] as string[]

    let assigneeMap = new Map<string, string>()
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nombre, apellido")
        .in("id", assigneeIds)

      for (const profile of profiles ?? []) {
        assigneeMap.set(
          profile.id,
          `${profile.nombre ?? ""} ${profile.apellido ?? ""}`.trim() || "Sin nombre",
        )
      }
    }

    const enriched = (data ?? []).map((row) => {
      const assets = row.assets as { name?: string; asset_id?: string } | null
      const departments = row.departments as { name?: string } | null
      const routedAt = row.routed_at as string | null
      const targetHours = row.target_response_hours as number | null
      const status = row.status as string | null

      return {
        ...row,
        asset_display_name: assets?.name ?? "Activo no encontrado",
        asset_code: assets?.asset_id ?? "N/A",
        department_name: departments?.name ?? null,
        assignee_name: row.assigned_to_id
          ? assigneeMap.get(row.assigned_to_id as string) ?? null
          : null,
        hours_since_routed: hoursSince(routedAt),
        sla_breached: isSlaBreached(routedAt, targetHours, status),
      }
    })

    return NextResponse.json(enriched)
  } catch (err) {
    console.error("GET routed incidents error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { incident_ids?: string[] }
    const incidentIds = body.incident_ids ?? []
    if (incidentIds.length === 0) {
      return NextResponse.json({ error: "incident_ids requerido" }, { status: 400 })
    }

    const supabase = await createClient()
    const results: { id: string; ok: boolean; error?: string }[] = []

    for (const incidentId of incidentIds) {
      const { error } = await supabase.rpc("apply_incident_routing", {
        p_incident_id: incidentId,
      })
      results.push({ id: incidentId, ok: !error, error: error?.message })
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error("POST route incidents error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
