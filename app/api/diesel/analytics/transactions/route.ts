import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getDieselPlantScope, plantFilterAllowed } from "@/lib/diesel-analytics-scope"

function endOfDayIso(dateStr: string | null): string | null {
  if (!dateStr) return null
  return `${dateStr}T23:59:59.999Z`
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await getDieselPlantScope(supabase)
    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get("warehouseId")
    const assetId = searchParams.get("assetId")
    const exceptionName = searchParams.get("exceptionName")
    const yearMonth = searchParams.get("yearMonth")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "30", 10)))

    if (!warehouseId) {
      return NextResponse.json(
        { error: "warehouseId is required" },
        { status: 400 }
      )
    }

    const { data: wh, error: whErr } = await supabase
      .from("diesel_warehouses")
      .select("id, plant_id")
      .eq("id", warehouseId)
      .single()

    if (whErr || !wh) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 })
    }

    if (!plantFilterAllowed(wh.plant_id, scope)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let q = supabase
      .from("diesel_transactions")
      .select(
        `
        id,
        transaction_date,
        quantity_liters,
        horometer_reading,
        kilometer_reading,
        previous_horometer,
        previous_kilometer,
        hours_consumed,
        kilometers_consumed,
        notes,
        created_by,
        diesel_products!inner(product_type),
        assets(asset_id, name)
      `,
        { count: "exact" }
      )
      .eq("warehouse_id", warehouseId)
      .eq("transaction_type", "consumption")
      .eq("is_transfer", false)
      .eq("diesel_products.product_type", "diesel")
      .order("transaction_date", { ascending: false })

    if (assetId) {
      q = q.eq("asset_id", assetId)
    } else if (exceptionName) {
      q = q.is("asset_id", null).eq("exception_asset_name", exceptionName)
    }

    if (yearMonth) {
      const start = `${yearMonth}-01T00:00:00.000Z`
      const [y, m] = yearMonth.split("-").map(Number)
      const next = new Date(Date.UTC(y, m, 1))
      const end = new Date(next.getTime() - 1).toISOString()
      q = q.gte("transaction_date", start).lte("transaction_date", end)
    } else {
      if (dateFrom) q = q.gte("transaction_date", `${dateFrom}T00:00:00.000Z`)
      if (dateTo) q = q.lte("transaction_date", endOfDayIso(dateTo) || "")
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const { data: rows, error, count } = await q.range(from, to)

    if (error) {
      console.error("[diesel analytics transactions]", error)
      return NextResponse.json(
        { error: "Failed to load transactions", details: error.message },
        { status: 500 }
      )
    }

    const userIds = [...new Set((rows ?? []).map((t: { created_by: string }) => t.created_by).filter(Boolean))]
    let names: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nombre, apellido")
        .in("id", userIds as string[])
      profs?.forEach((p: { id: string; nombre: string | null; apellido: string | null }) => {
        names[p.id] = `${p.nombre || ""} ${p.apellido || ""}`.trim() || "Usuario"
      })
    }

    const transactions = (rows ?? []).map((t: any) => ({
      id: t.id,
      transaction_date: t.transaction_date,
      quantity_liters: t.quantity_liters,
      horometer_reading: t.horometer_reading,
      kilometer_reading: t.kilometer_reading,
      previous_horometer: t.previous_horometer,
      previous_kilometer: t.previous_kilometer,
      hours_consumed: t.hours_consumed,
      kilometers_consumed: t.kilometers_consumed,
      notes: t.notes,
      created_by_name: names[t.created_by] || "Usuario",
      asset_code: t.assets?.asset_id ?? null,
      asset_name: t.assets?.name ?? null,
    }))

    return NextResponse.json({
      transactions,
      totalCount: count ?? 0,
      page,
      pageSize,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
