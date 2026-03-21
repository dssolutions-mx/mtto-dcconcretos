/**
 * Work orders list API — single round-trip, parallel fetches, minimal payload.
 * Replaces 4 client-side Supabase calls with 1 API call.
 */

import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

const WORK_ORDER_COLUMNS =
  "id, order_id, asset_id, description, type, priority, status, planned_date, created_at, assigned_to, purchase_order_id, incident_id, checklist_id, maintenance_plan_id, preventive_checklist_id, escalation_count, related_issues_count, required_tasks, required_parts, last_escalation_date"

export async function GET() {
  try {
    const supabase = await createClient()

    // Batch 1: work orders + active technicians (parallel). No limit — search must work on full dataset.
    const workOrdersPromise = supabase
      .from("work_orders")
      .select(
        `
        ${WORK_ORDER_COLUMNS},
        asset:assets (
          id,
          name,
          asset_id,
          plant_id
        )
      `
      )
      .order("created_at", { ascending: false })

    const activeTechsPromise = supabase
      .from("profiles")
      .select("id, nombre, apellido")
      .eq("is_active", true)
      .limit(500)

    const [{ data: workOrdersData, error: woError }, { data: activeTechs, error: activeTechError }] =
      await Promise.all([workOrdersPromise, activeTechsPromise])

    if (woError) {
      console.error("Error fetching work orders:", woError)
      return NextResponse.json({ error: woError.message }, { status: 500 })
    }

    const workOrders = workOrdersData ?? []

    const techMap: Record<string, { id: string; nombre: string | null; apellido: string | null }> = {}
    if (!activeTechError && activeTechs) {
      activeTechs.forEach((t) => {
        techMap[t.id] = t
      })
    }

    const assignedIds = [...new Set(workOrders.filter((o) => o.assigned_to).map((o) => o.assigned_to as string))]
    const poIds = workOrders
      .filter((o) => o.purchase_order_id)
      .map((o) => o.purchase_order_id as string)

    // Batch 2: assigned technicians + purchase order statuses (parallel)
    const [assignedResult, poResult] = await Promise.all([
      assignedIds.length > 0
        ? supabase.from("profiles").select("id, nombre, apellido").in("id", assignedIds)
        : Promise.resolve({ data: [], error: null }),
      poIds.length > 0
        ? supabase.from("purchase_orders").select("id, status").in("id", poIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (!assignedResult.error && assignedResult.data) {
      assignedResult.data.forEach((t) => {
        techMap[t.id] = t
      })
    }

    const purchaseOrderStatuses: Record<string, string> = {}
    if (!poResult.error && poResult.data) {
      poResult.data.forEach((po) => {
        purchaseOrderStatuses[po.id] = po.status
      })
    }

    return NextResponse.json({
      workOrders,
      technicians: techMap,
      purchaseOrderStatuses,
      totalCount: workOrders.length,
    })
  } catch (err) {
    console.error("Work orders list API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
