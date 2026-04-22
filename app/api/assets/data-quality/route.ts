import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/** Missing model, missing model year on catalog, data-quality for Pendientes panel */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: assetsNoModel, error: a1 } = await supabase
      .from('assets')
      .select('id, asset_id, name')
      .is('model_id', null)

    const { data: modelsNoYear, error: a2 } = await supabase
      .from('equipment_models')
      .select('id, model_id, name, manufacturer')
      .is('year_introduced', null)

    if (a1) console.warn(a1)
    if (a2) console.warn(a2)

    return NextResponse.json({
      missing_model: assetsNoModel ?? [],
      missing_model_year: modelsNoYear ?? [],
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
