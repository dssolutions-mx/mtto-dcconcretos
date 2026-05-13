import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

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

    const { searchParams } = new URL(req.url)
    const assetId = searchParams.get('assetId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!assetId || !from || !to) {
      return NextResponse.json({ error: 'assetId, from y to son requeridos' }, { status: 400 })
    }

    const url = process.env.COTIZADOR_SUPABASE_URL
    const key = process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ remisiones: [] })
    }

    const cotizador = createClient(url, key, { auth: { persistSession: false } })

    const { data, error } = await cotizador
      .from('remisiones')
      .select('remision_number, fecha, hora_carga, volumen_fabricado, cancelled_reason')
      .eq('unidad', assetId)
      .gte('fecha', from)
      .lte('fecha', to)
      .order('fecha', { ascending: true })
      .order('hora_carga', { ascending: true })

    if (error) {
      console.error('[cotizador/remisiones]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ remisiones: (data ?? []) as RemisionRow[] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
