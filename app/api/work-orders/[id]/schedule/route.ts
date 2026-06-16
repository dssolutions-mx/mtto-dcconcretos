/**
 * Schedule a work order: assign technician and planned date.
 * Updates status to Programada when both are set.
 */

import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

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
    const { planned_date, assigned_to, status, priority } = body as {
      planned_date?: string | null
      assigned_to?: string | null
      status?: string | null
      priority?: string | null
    }

    if (
      planned_date === undefined &&
      assigned_to === undefined &&
      status === undefined &&
      priority === undefined
    ) {
      return NextResponse.json(
        { error: "Se requiere al menos un campo para actualizar" },
        { status: 400 },
      )
    }

    const updatePayload: Record<string, unknown> = {}
    if (planned_date !== undefined) updatePayload.planned_date = planned_date
    if (assigned_to !== undefined) updatePayload.assigned_to = assigned_to
    if (priority !== undefined) updatePayload.priority = priority

    const { data: existing, error: fetchError } = await supabase
      .from("work_orders")
      .select("id, status, planned_date, assigned_to")
      .eq("id", id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Orden de trabajo no encontrada" }, { status: 404 })
    }

    const nextPlanned = planned_date !== undefined ? planned_date : existing.planned_date
    const nextAssigned = assigned_to !== undefined ? assigned_to : existing.assigned_to

    if (status !== undefined && status !== null) {
      updatePayload.status = status
    } else if (nextPlanned && nextAssigned && existing.status === "Pendiente") {
      updatePayload.status = "Programada"
    }

    const { data: updated, error: updateError } = await supabase
      .from("work_orders")
      .update(updatePayload)
      .eq("id", id)
      .select("id, order_id, planned_date, assigned_to, status, incident_id")
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, work_order: updated })
  } catch (error) {
    console.error("Error scheduling work order:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
