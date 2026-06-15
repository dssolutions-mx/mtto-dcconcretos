import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: campaignId } = await params
    const supabase = await createClient()
    const { work_order_ids } = await request.json()

    if (!Array.isArray(work_order_ids) || work_order_ids.length === 0) {
      return NextResponse.json({ error: "work_order_ids requerido" }, { status: 400 })
    }

    const rows = work_order_ids.map((woId: string) => ({
      campaign_id: campaignId,
      work_order_id: woId,
    }))

    const { error } = await supabase
      .from("campaign_work_orders")
      .upsert(rows, { onConflict: "campaign_id,work_order_id", ignoreDuplicates: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, added: work_order_ids.length })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: campaignId } = await params
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const woId = searchParams.get("workOrderId")

    if (!woId) {
      return NextResponse.json({ error: "workOrderId requerido" }, { status: 400 })
    }

    const { error } = await supabase
      .from("campaign_work_orders")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("work_order_id", woId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
