import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getDieselPlantScope, plantFilterAllowed } from "@/lib/diesel-analytics-scope"

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
    const yearMonthFrom = searchParams.get("yearMonthFrom")
    const yearMonthTo = searchParams.get("yearMonthTo")

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
      .from("diesel_monthly_consumption_by_asset")
      .select("*")
      .eq("warehouse_id", warehouseId)
      .order("year_month", { ascending: false })

    if (assetId) {
      q = q.eq("asset_id", assetId).is("exception_asset_name", null)
    } else if (exceptionName) {
      q = q.eq("exception_asset_name", exceptionName).is("asset_id", null)
    } else {
      return NextResponse.json(
        { error: "assetId or exceptionName is required" },
        { status: 400 }
      )
    }

    if (yearMonthFrom) q = q.gte("year_month", yearMonthFrom)
    if (yearMonthTo) q = q.lte("year_month", yearMonthTo)

    const { data, error } = await q

    if (error) {
      console.error("[diesel analytics monthly]", error)
      return NextResponse.json(
        { error: "Failed to load monthly series", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ months: data ?? [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
