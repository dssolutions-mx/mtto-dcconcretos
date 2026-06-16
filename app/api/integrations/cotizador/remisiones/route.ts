import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { canAccessAgendaIntegrations } from '@/lib/agenda/agenda-auth'

export type RemisionRow = {
  remision_number: string
  fecha: string
  hora_carga: string
  volumen_fabricado: number | null
  cancelled_reason: string | null
}

/**
 * GET /api/integrations/cotizador/remisiones?assetId=CR-20&from=2026-03-28&to=2026-04-30
 * Returns concrete delivery tickets (remisiones) for a given asset and date range.
 * Queries cotizador Supabase where `unidad` matches the maintenance `asset_id`.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.is_active) {
      return NextResponse.json({ error: 'Perfil no encontrado o inactivo' }, { status: 403 })
    }

    if (!canAccessAgendaIntegrations(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const assetId = searchParams.get('assetId')
    const assetIdsParam = searchParams.get('assetIds')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const assetIds = assetIdsParam
      ? [...new Set(assetIdsParam.split(',').map((value) => value.trim()).filter(Boolean))]
      : assetId
        ? [assetId]
        : []

    if (assetIds.length === 0 || !from || !to) {
      return NextResponse.json({ error: 'assetId o assetIds, from y to son requeridos' }, { status: 400 })
    }

    const url = process.env.COTIZADOR_SUPABASE_URL
    const key = process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ remisiones: [] })
    }

    const cotizador = createClient(url, key, { auth: { persistSession: false } })

    const { data, error } = await cotizador
      .from('remisiones')
      .select('remision_number, fecha, hora_carga, volumen_fabricado, cancelled_reason, unidad')
      .in('unidad', assetIds)
      .gte('fecha', from)
      .lte('fecha', to)
      .order('fecha', { ascending: true })
      .order('hora_carga', { ascending: true })

    if (error) {
      console.error('[cotizador/remisiones]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const remisionesByAsset: Record<string, RemisionRow[]> = {}
    for (const asset of assetIds) {
      remisionesByAsset[asset] = []
    }

    for (const row of data ?? []) {
      const unit = (row as { unidad?: string }).unidad
      if (!unit) continue
      if (!remisionesByAsset[unit]) remisionesByAsset[unit] = []
      remisionesByAsset[unit].push({
        remision_number: row.remision_number,
        fecha: row.fecha,
        hora_carga: row.hora_carga,
        volumen_fabricado: row.volumen_fabricado,
        cancelled_reason: row.cancelled_reason,
      })
    }

    const remisiones = assetIds.length === 1 ? remisionesByAsset[assetIds[0]!] ?? [] : []

    return NextResponse.json({ remisiones, remisiones_by_asset: remisionesByAsset })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
