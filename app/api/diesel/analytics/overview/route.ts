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
      return NextResponse.json({
        totals: {
          total_consumption: 0,
          total_entries: 0,
          total_transfer_consumption_liters: 0,
          consumption_transaction_count: 0,
        },
        warehouses: [] as unknown[],
      })
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    const pFrom = dateFrom ? `${dateFrom}T00:00:00.000Z` : null
    const pTo = endOfDayIso(dateTo)

    const plantArg = scope.plantIds

    const { data: totalsRaw, error: totErr } = await supabase.rpc(
      "diesel_analytics_overview_totals",
      {
        p_from: pFrom,
        p_to: pTo,
        p_plant_ids: plantArg,
      }
    )

    if (totErr) {
      console.error("[diesel analytics overview totals]", totErr)
      return NextResponse.json(
        { error: "Failed to load totals", details: totErr.message },
        { status: 500 }
      )
    }

    const { data: warehouses, error: whErr } = await supabase.rpc(
      "diesel_analytics_warehouse_period",
      {
        p_from: pFrom,
        p_to: pTo,
        p_plant_ids: plantArg,
      }
    )

    if (whErr) {
      console.error("[diesel analytics warehouse period]", whErr)
      return NextResponse.json(
        { error: "Failed to load warehouses", details: whErr.message },
        { status: 500 }
      )
    }

    const totals =
      totalsRaw && typeof totalsRaw === "object"
        ? (totalsRaw as Record<string, unknown>)
        : {
            total_consumption: 0,
            total_entries: 0,
            total_transfer_consumption_liters: 0,
            consumption_transaction_count: 0,
          }

    return NextResponse.json({
      totals: {
        total_consumption: Number(totals.total_consumption ?? 0),
        total_entries: Number(totals.total_entries ?? 0),
        total_transfer_consumption_liters: Number(
          totals.total_transfer_consumption_liters ?? 0
        ),
        consumption_transaction_count: Number(
          totals.consumption_transaction_count ?? 0
        ),
      },
      warehouses: warehouses ?? [],
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
