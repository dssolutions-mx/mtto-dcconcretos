import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("maintenance_campaigns")
      .select(
        `
        *,
        plant:plants(id, name),
        owner:profiles!maintenance_campaigns_owner_id_fkey(id, nombre, apellido),
        campaign_work_orders(
          added_at,
          work_orders(
            id, order_id, description, status, priority, asset_id, assigned_to,
            asset:assets(id, name, asset_id, plant_id, plants(name))
          )
        )
      `,
      )
      .eq("id", id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 })
    }

    const links = (data.campaign_work_orders ?? []) as Array<{
      added_at: string
      work_orders: Record<string, unknown> | null
    }>
    const workOrders = links.map((l) => l.work_orders).filter(Boolean)
    const completed = workOrders.filter((wo) => wo?.status === "Completada").length

    return NextResponse.json({
      ...data,
      work_orders: workOrders,
      work_order_count: workOrders.length,
      completed_count: completed,
      progress_pct:
        workOrders.length > 0 ? Math.round((completed / workOrders.length) * 100) : 0,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const allowed = [
      "name",
      "description",
      "status",
      "owner_id",
      "target_start",
      "target_end",
      "notes",
    ] as const

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in body) patch[key] = body[key]
    }

    const { data, error } = await supabase
      .from("maintenance_campaigns")
      .update(patch)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
