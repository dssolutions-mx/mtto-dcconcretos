/**
 * Work agenda API — scheduled work orders for a date range, optionally filtered by technician.
 */

import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"
import { inferWorkOrderOrigin } from "@/lib/agenda/agenda-utils"

const ACTIVE_STATUSES = ["Pendiente", "Programada", "Esperando repuestos"]

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const assignedTo = searchParams.get("assigned_to")
    const includeUnscheduled = searchParams.get("include_unscheduled") === "true"

    if (!from || !to) {
      return NextResponse.json(
        { error: "Parámetros from y to son requeridos (yyyy-MM-dd)" },
        { status: 400 },
      )
    }

    let scheduledQuery = supabase
      .from("work_orders")
      .select(
        `
        id, order_id, description, priority, status, planned_date, assigned_to,
        incident_id, checklist_id, maintenance_plan_id, asset_id, created_at,
        asset:assets ( id, name, asset_id )
      `,
      )
      .gte("planned_date", from)
      .lte("planned_date", to)
      .in("status", ACTIVE_STATUSES)
      .order("planned_date", { ascending: true })

    if (assignedTo) {
      scheduledQuery = scheduledQuery.eq("assigned_to", assignedTo)
    }

    const scheduledPromise = scheduledQuery

    const unscheduledPromise = includeUnscheduled
      ? (() => {
          let q = supabase
            .from("work_orders")
            .select(
              `
          id, order_id, description, priority, status, planned_date, assigned_to,
          incident_id, checklist_id, maintenance_plan_id, asset_id, created_at,
          asset:assets ( id, name, asset_id )
        `,
            )
            .is("planned_date", null)
            .in("status", ACTIVE_STATUSES)
            .order("created_at", { ascending: false })
            .limit(50)
          return q
        })()
      : null

    const techsPromise = supabase
      .from("profiles")
      .select("id, nombre, apellido")
      .eq("is_active", true)
      .limit(500)

    const [scheduledRes, unscheduledRes, techsRes] = await Promise.all([
      scheduledPromise,
      unscheduledPromise ?? Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
      techsPromise,
    ])

    if (scheduledRes.error) {
      return NextResponse.json({ error: scheduledRes.error.message }, { status: 500 })
    }

    const techMap: Record<string, string> = {}
    for (const t of techsRes.data ?? []) {
      techMap[t.id] = [t.nombre, t.apellido].filter(Boolean).join(" ") || "Sin nombre"
    }

    const incidentIds = [
      ...new Set(
        [...(scheduledRes.data ?? []), ...(unscheduledRes.data ?? [])]
          .map((wo) => wo.incident_id)
          .filter(Boolean),
      ),
    ] as string[]

    let incidentMap: Record<
      string,
      { created_at: string; status: string; first_planned_at?: string | null }
    > = {}

    if (incidentIds.length > 0) {
      const { data: incidents } = await supabase
        .from("incident_history")
        .select("id, created_at, status, first_planned_at")
        .in("id", incidentIds)

      for (const inc of incidents ?? []) {
        incidentMap[inc.id] = {
          created_at: inc.created_at,
          status: inc.status,
          first_planned_at: inc.first_planned_at,
        }
      }
    }

    const mapWorkOrder = (wo: Record<string, unknown>) => {
      const asset = wo.asset as { name?: string; asset_id?: string } | null
      const incidentId = wo.incident_id as string | null
      const incident = incidentId ? incidentMap[incidentId] : null
      const hoursOpen = incident?.created_at
        ? Math.ceil(
            (Date.now() - new Date(incident.created_at).getTime()) / (1000 * 60 * 60 * 24),
          )
        : null

      return {
        id: wo.id,
        order_id: wo.order_id,
        description: wo.description,
        priority: wo.priority,
        status: wo.status,
        planned_date: wo.planned_date,
        assigned_to: wo.assigned_to,
        incident_id: incidentId,
        asset_id: wo.asset_id,
        asset_name: asset?.name ?? null,
        asset_code: asset?.asset_id ?? null,
        technician_name: wo.assigned_to ? techMap[wo.assigned_to as string] ?? null : null,
        origin: inferWorkOrderOrigin({
          incident_id: incidentId,
          checklist_id: wo.checklist_id as string | null,
          maintenance_plan_id: wo.maintenance_plan_id as string | null,
        }),
        incident_created_at: incident?.created_at ?? null,
        incident_status: incident?.status ?? null,
        hours_open: hoursOpen,
      }
    }

    return NextResponse.json({
      scheduled: (scheduledRes.data ?? []).map(mapWorkOrder),
      unscheduled: (unscheduledRes.data ?? []).map(mapWorkOrder),
      technicians: Object.entries(techMap).map(([id, name]) => ({ id, name })),
    })
  } catch (error) {
    console.error("Error in work agenda API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
