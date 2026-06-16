/**
 * Schedule a work order with optional service window, asset status, and ops notification.
 */

import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"
import { checkAssetAvailability } from "@/lib/agenda/production-availability"
import { createServiceWindow } from '@/lib/planning/service-windows'

async function tryCreateServiceWindow(
  supabase: ReturnType<typeof createClient>,
  input: Parameters<typeof createServiceWindow>[1],
) {
  try {
    return await createServiceWindow(supabase, input)
  } catch (e) {
    console.warn('[schedule] service window creation skipped (migration pending?):', e)
    return null
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const {
      planned_date,
      assigned_to,
      planned_start_at,
      planned_end_at,
      estimated_duration_hours,
      confirm_service_window,
      notify_operations,
      force_schedule,
    } = body as {
      planned_date?: string | null
      assigned_to?: string | null
      planned_start_at?: string | null
      planned_end_at?: string | null
      estimated_duration_hours?: number
      confirm_service_window?: boolean
      notify_operations?: boolean
      force_schedule?: boolean
    }

    if (
      planned_date === undefined &&
      assigned_to === undefined &&
      !planned_start_at
    ) {
      return NextResponse.json(
        { error: "Se requiere planned_date, planned_start_at y/o assigned_to" },
        { status: 400 },
      )
    }

    const { data: existing, error: fetchError } = await supabase
      .from("work_orders")
      .select(
        "id, order_id, status, planned_date, assigned_to, asset_id, plant_id, estimated_duration, incident_id",
      )
      .eq("id", id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Orden de trabajo no encontrada" }, { status: 404 })
    }

    const durationH = estimated_duration_hours ?? existing.estimated_duration ?? 4
    const dateStr = planned_date ?? planned_start_at?.slice(0, 10) ?? existing.planned_date

    let startsAt = planned_start_at
    let endsAt = planned_end_at

    if (dateStr && !startsAt) {
      startsAt = `${dateStr}T06:00:00.000Z`
    }
    if (startsAt && !endsAt) {
      const start = new Date(startsAt)
      endsAt = new Date(start.getTime() + durationH * 3_600_000).toISOString()
    }

    let availability = null
    if (existing.asset_id && startsAt && endsAt && !force_schedule) {
      availability = await checkAssetAvailability(supabase, {
        asset_id: existing.asset_id,
        starts_at: startsAt,
        ends_at: endsAt,
      })
      if (!availability.can_schedule) {
        return NextResponse.json(
          {
            error: "Conflicto de disponibilidad",
            availability,
          },
          { status: 409 },
        )
      }
    }

    const updatePayload: Record<string, unknown> = {}
    if (planned_date !== undefined) updatePayload.planned_date = planned_date
    if (assigned_to !== undefined) updatePayload.assigned_to = assigned_to
    if (startsAt) updatePayload.planned_start_at = startsAt
    if (endsAt) updatePayload.planned_end_at = endsAt
    if (estimated_duration_hours !== undefined) {
      updatePayload.estimated_duration = estimated_duration_hours
    }

    const nextPlanned = dateStr ?? existing.planned_date
    const nextAssigned =
      assigned_to !== undefined ? assigned_to : existing.assigned_to

    if (nextPlanned && nextAssigned && existing.status === "Pendiente") {
      updatePayload.status = "Programada"
    }

    let serviceWindow = null
    if (existing.asset_id && startsAt && endsAt && confirm_service_window !== false) {
      serviceWindow = await tryCreateServiceWindow(supabase, {
        asset_id: existing.asset_id,
        work_order_id: id,
        plant_id: existing.plant_id,
        starts_at: startsAt,
        ends_at: endsAt,
        reason: existing.incident_id ? "corrective" : "preventive",
        confirm: true,
        notify_operations: notify_operations ?? true,
        created_by: user.id,
      })
      if (serviceWindow?.id) {
        updatePayload.service_window_id = serviceWindow.id
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("work_orders")
      .update(updatePayload)
      .eq("id", id)
      .select(
        "id, order_id, planned_date, planned_start_at, planned_end_at, assigned_to, status, incident_id, service_window_id",
      )
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      work_order: updated,
      service_window: serviceWindow,
      availability,
    })
  } catch (error) {
    console.error("Error scheduling work order:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
