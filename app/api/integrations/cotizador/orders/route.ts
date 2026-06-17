import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerSupabase } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"
import {
  buildCotizadorPlantMaps,
  resolveCotizadorPlantIds,
} from "@/lib/agenda/cotizador-plant-map"
import { flattenCotizadorOrders, type CotizadorOrderItemRow } from "@/lib/agenda/cotizador-orders"
import { canAccessAgendaIntegrations, canViewCotizadorPlantMapping } from "@/lib/agenda/agenda-auth"

export type { CotizadorOrderItemRow }

/**
 * GET /api/integrations/cotizador/orders?from=&to=&plantIds=
 * Planning orders from Cotizador (created/validated) for a delivery date range.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single()

    if (profileError || !profile || !profile.is_active) {
      return NextResponse.json({ error: "Perfil no encontrado o inactivo" }, { status: 403 })
    }

    if (!canAccessAgendaIntegrations(profile.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const plantIdsParam = searchParams.get("plantIds")
    const includePump = searchParams.get("include_pump") === "true"

    if (!from || !to) {
      return NextResponse.json({ error: "from y to son requeridos" }, { status: 400 })
    }

    const url = process.env.COTIZADOR_SUPABASE_URL
    const key = process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ orders: [], configured: false })
    }

    const plantMaps = await buildCotizadorPlantMaps(supabase)
    const cotizadorPlantIds = resolveCotizadorPlantIds(plantIdsParam, plantMaps)

    const cotizador = createClient(url, key, { auth: { persistSession: false } })

    let query = cotizador
      .from("orders")
      .select(
        `
        id,
        order_number,
        delivery_date,
        delivery_time,
        construction_site,
        plant_id,
        order_status,
        plant:plants(id, name),
        client:clients(business_name),
        order_items(
          product_type,
          volume,
          pump_volume,
          has_pump_service,
          has_empty_truck_charge,
          concrete_volume_delivered
        )
      `,
      )
      .in("order_status", ["created", "validated"])
      .gte("delivery_date", from)
      .lte("delivery_date", to)
      .order("delivery_date", { ascending: true })
      .order("delivery_time", { ascending: true })

    if (cotizadorPlantIds?.length) {
      query = query.in("plant_id", cotizadorPlantIds)
    }

    const { data, error } = await query

    if (error) {
      console.error("[cotizador/orders]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const orders = flattenCotizadorOrders(data ?? [], { includePumpLines: includePump })

    return NextResponse.json({
      configured: true,
      orders,
      ...(canViewCotizadorPlantMapping(profile.role)
        ? { plant_mapping: Object.fromEntries(plantMaps.cotizadorToMaintenance) }
        : {}),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
