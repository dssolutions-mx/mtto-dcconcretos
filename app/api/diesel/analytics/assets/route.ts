import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getDieselPlantScope } from "@/lib/diesel-analytics-scope"

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
      return NextResponse.json({ assets: [] })
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const warehouseId = searchParams.get("warehouseId")

    const pFrom = dateFrom ? `${dateFrom}T00:00:00.000Z` : null
    const pTo = endOfDayIso(dateTo)

    const { data, error } = await supabase.rpc("diesel_analytics_assets_in_period", {
      p_from: pFrom,
      p_to: pTo,
      p_warehouse_id: warehouseId || null,
      p_plant_ids: scope.plantIds,
    })

    if (error) {
      console.error("[diesel analytics assets]", error)
      return NextResponse.json(
        { error: "Failed to load assets", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ assets: data ?? [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
