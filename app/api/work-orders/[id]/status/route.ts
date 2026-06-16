/**
 * Quick status update for mechanics (start / waiting parts) without full WO form.
 */

import { createClient } from "@/lib/supabase-server"
import { WorkOrderStatus } from "@/types"
import { NextResponse } from "next/server"

const ALLOWED_STATUSES = new Set([
  WorkOrderStatus.Pending,
  WorkOrderStatus.Programmed,
  WorkOrderStatus.WaitingParts,
  "En ejecución",
  "En Progreso",
])

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
    const { status } = body as { status?: string }

    if (!status || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Estado no válido" }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from("work_orders")
      .select("id, status")
      .eq("id", id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Orden de trabajo no encontrada" }, { status: 404 })
    }

    if (existing.status === WorkOrderStatus.Completed) {
      return NextResponse.json({ error: "La orden ya está completada" }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from("work_orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, order_id, status")
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, work_order: updated })
  } catch (error) {
    console.error("Error updating work order status:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
