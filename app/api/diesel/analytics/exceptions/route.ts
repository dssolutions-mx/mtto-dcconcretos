import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getDieselPlantScope } from "@/lib/diesel-analytics-scope"
import { buildDieselExceptionFlags } from "@/lib/diesel-analytics-exceptions"

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
    if (scope.plantIds !== null && scope.plantIds.length === 0) {
      return NextResponse.json({ exceptions: [] })
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const limit = Math.min(3000, Math.max(100, parseInt(searchParams.get("limit") || "1500", 10)))

    const pFrom = dateFrom ? `${dateFrom}T00:00:00.000Z` : null
    const pTo = endOfDayIso(dateTo)

    let warehouseIds: string[] | null = null
    if (scope.plantIds !== null) {
      const { data: whRows } = await supabase
        .from("diesel_warehouses")
        .select("id")
        .eq("product_type", "diesel")
        .in("plant_id", scope.plantIds)
      warehouseIds = (whRows ?? []).map((w) => w.id)
      if (warehouseIds.length === 0) {
        return NextResponse.json({ exceptions: [], scanned: 0 })
      }
    }

    let q = supabase
      .from("diesel_transactions")
      .select(
        `
        id,
        transaction_date,
        warehouse_id,
        asset_id,
        exception_asset_name,
        quantity_liters,
        horometer_reading,
        kilometer_reading,
        hours_consumed,
        kilometers_consumed,
        diesel_products!inner(product_type)
      `
      )
      .eq("transaction_type", "consumption")
      .eq("is_transfer", false)
      .eq("diesel_products.product_type", "diesel")
      .order("transaction_date", { ascending: true })
      .limit(limit)

    if (warehouseIds) q = q.in("warehouse_id", warehouseIds)

    if (pFrom) q = q.gte("transaction_date", pFrom)
    if (pTo) q = q.lte("transaction_date", pTo)

    const { data: rows, error } = await q

    if (error) {
      console.error("[diesel analytics exceptions]", error)
      return NextResponse.json(
        { error: "Failed to load consumptions", details: error.message },
        { status: 500 }
      )
    }

    const flat = (rows ?? []).map((t: any) => ({
      id: t.id,
      transaction_date: t.transaction_date,
      warehouse_id: t.warehouse_id,
      asset_id: t.asset_id,
      exception_asset_name: t.exception_asset_name,
      quantity_liters: t.quantity_liters,
      horometer_reading: t.horometer_reading,
      kilometer_reading: t.kilometer_reading,
      hours_consumed: t.hours_consumed,
      kilometers_consumed: t.kilometers_consumed,
    }))

    const exceptions = buildDieselExceptionFlags(flat)

    return NextResponse.json({
      exceptions,
      scanned: flat.length,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
