/**
 * Daily insumos kit — parts required for scheduled work on a given date.
 */

import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"
import {
  consolidateKitLines,
  extractPartsFromWorkOrder,
  recomputeKitSufficiency,
  type ConsolidatedKitLine,
} from "@/lib/agenda/aggregate-daily-kit"
import { AGENDA_ACTIVE_STATUSES } from "@/lib/agenda/agenda-utils"
import { StockService, type PartAvailability } from "@/lib/services/stock-service"

const ACTIVE_STATUSES = [...AGENDA_ACTIVE_STATUSES]

export type DailyKitWorkOrderParts = {
  work_order_id: string
  order_id: string
  asset_id: string | null
  asset_code: string | null
  asset_name: string | null
  plant_id: string | null
  parts: Array<{
    part_id: string | null
    part_number: string
    name: string
    quantity: number
    total_available: number | null
    sufficient: boolean | null
  }>
}

/**
 * GET /api/work-orders/agenda/daily-kit?date=YYYY-MM-DD&technicianId=
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")
    const technicianId = searchParams.get("technicianId")

    if (!date) {
      return NextResponse.json({ error: "date es requerido (yyyy-MM-dd)" }, { status: 400 })
    }

    let woQuery = supabase
      .from("work_orders")
      .select(
        `
        id,
        order_id,
        asset_id,
        required_parts,
        required_tasks,
        asset:assets(id, asset_id, name, plant_id)
      `,
      )
      .eq("planned_date", date)
      .in("status", ACTIVE_STATUSES)

    if (technicianId) {
      woQuery = woQuery.eq("assigned_to", technicianId)
    }

    const { data: workOrders, error } = await woQuery
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const allLines = (workOrders ?? []).flatMap((wo) => {
      const asset = wo.asset as { plant_id?: string | null } | null
      return extractPartsFromWorkOrder(
        {
          id: wo.id,
          order_id: wo.order_id,
          asset_id: wo.asset_id,
          required_parts: wo.required_parts,
          required_tasks: wo.required_tasks,
        },
        asset?.plant_id,
      )
    })

    const partsByPlant = new Map<string, Map<string, number>>()
    for (const wo of workOrders ?? []) {
      const asset = wo.asset as {
        plant_id?: string | null
      } | null
      const plantId = asset?.plant_id
      if (!plantId) continue

      const woLines = extractPartsFromWorkOrder(
        {
          id: wo.id,
          order_id: wo.order_id,
          asset_id: wo.asset_id,
          required_parts: wo.required_parts,
          required_tasks: wo.required_tasks,
        },
        plantId,
      )

      if (!partsByPlant.has(plantId)) partsByPlant.set(plantId, new Map())
      const plantParts = partsByPlant.get(plantId)!
      for (const line of woLines) {
        if (!line.part_id) continue
        const prev = plantParts.get(line.part_id) ?? 0
        plantParts.set(line.part_id, prev + Number(line.quantity ?? 0))
      }
    }

    const availabilityByPartId = new Map<string, PartAvailability>()
    for (const [plantId, partQtyMap] of partsByPlant) {
      const parts = [...partQtyMap.entries()].map(([part_id, quantity]) => ({
        part_id,
        quantity,
      }))
      const availabilities = await StockService.checkMultiplePartsAvailability(parts, plantId)
      for (const row of availabilities) {
        availabilityByPartId.set(`${plantId}:${row.part_id}`, row)
      }
    }

    const kit = recomputeKitSufficiency(consolidateKitLines(allLines, availabilityByPartId))

    const byWorkOrder: DailyKitWorkOrderParts[] = (workOrders ?? []).map((wo) => {
      const asset = wo.asset as {
        asset_id?: string | null
        name?: string | null
        plant_id?: string | null
      } | null
      const woLines = extractPartsFromWorkOrder(
        {
          id: wo.id,
          order_id: wo.order_id,
          asset_id: wo.asset_id,
          required_parts: wo.required_parts,
          required_tasks: wo.required_tasks,
        },
        asset?.plant_id,
      )
      const woKit = consolidateKitLines(woLines, availabilityByPartId)

      return {
        work_order_id: wo.id,
        order_id: wo.order_id,
        asset_id: wo.asset_id,
        asset_code: asset?.asset_id ?? null,
        asset_name: asset?.name ?? null,
        plant_id: asset?.plant_id ?? null,
        parts: woKit.map((p) => ({
          part_id: p.part_id,
          part_number: p.part_number,
          name: p.name,
          quantity: p.required_quantity,
          total_available: p.total_available,
          sufficient: p.sufficient,
        })),
      }
    })

    const plantIds = [
      ...new Set(
        (workOrders ?? [])
          .map((wo) => (wo.asset as { plant_id?: string | null } | null)?.plant_id)
          .filter(Boolean),
      ),
    ] as string[]

    const summary = {
      total_parts: kit.length,
      insufficient: kit.filter((k) => k.sufficient === false).length,
      unknown: kit.filter((k) => k.sufficient == null).length,
      sufficient: kit.filter((k) => k.sufficient === true).length,
    }

    return NextResponse.json({
      date,
      technician_id: technicianId,
      work_order_count: workOrders?.length ?? 0,
      plant_ids: plantIds,
      kit: kit satisfies ConsolidatedKitLine[],
      by_work_order: byWorkOrder,
      summary,
    })
  } catch (error) {
    console.error("Error in daily-kit API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
