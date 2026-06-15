import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    let query = supabase
      .from("maintenance_campaigns")
      .select(
        `
        *,
        plant:plants(id, name),
        owner:profiles!maintenance_campaigns_owner_id_fkey(id, nombre, apellido),
        campaign_work_orders(work_order_id, work_orders(id, status, order_id))
      `,
      )
      .order("created_at", { ascending: false })

    if (status) query = query.eq("status", status)

    const { data, error } = await query
    if (error) {
      console.error("campaigns list error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const campaigns = (data ?? []).map((c) => {
      const links = (c.campaign_work_orders ?? []) as Array<{
        work_order_id: string
        work_orders: { id: string; status: string | null; order_id: string | null } | null
      }>
      const total = links.length
      const completed = links.filter(
        (l) => l.work_orders?.status === "Completada",
      ).length
      return {
        ...c,
        work_order_count: total,
        completed_count: completed,
        progress_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      }
    })

    return NextResponse.json(campaigns)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const body = await request.json()
    const {
      name,
      description,
      theme,
      cohort_id,
      plant_id,
      owner_id,
      target_start,
      target_end,
      notes,
      work_order_ids,
    } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 })
    }

    const { data: campaign, error } = await supabase
      .from("maintenance_campaigns")
      .insert({
        name: name.trim(),
        description: description ?? null,
        theme: theme ?? null,
        cohort_id: cohort_id ?? null,
        plant_id: plant_id ?? null,
        owner_id: owner_id ?? user.id,
        target_start: target_start ?? null,
        target_end: target_end ?? null,
        notes: notes ?? null,
        created_by: user.id,
        status: "planificada",
      })
      .select()
      .single()

    if (error || !campaign) {
      return NextResponse.json({ error: error?.message ?? "Error al crear" }, { status: 500 })
    }

    if (Array.isArray(work_order_ids) && work_order_ids.length > 0) {
      const rows = work_order_ids.map((woId: string) => ({
        campaign_id: campaign.id,
        work_order_id: woId,
      }))
      await supabase.from("campaign_work_orders").insert(rows)
    }

    return NextResponse.json(campaign, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
