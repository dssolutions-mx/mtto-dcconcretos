import { createClient } from '@/lib/supabase-server'
import {
  getNextInternalCode,
  loadPlantCode,
  loadTireIdRules,
  previewInternalCode,
} from '@/lib/tires/identifier'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const plantId = request.nextUrl.searchParams.get('plant_id')?.trim() || null
    const plantCode = plantId ? await loadPlantCode(supabase, plantId) : null
    const rules = await loadTireIdRules(supabase, plantId)

    if (rules.auto_generate) {
      const preview_code = await getNextInternalCode(supabase, rules, plantId)
      return NextResponse.json({
        preview_code,
        auto_generate: true,
        id_rules: rules,
        plant_code: plantCode,
      })
    }

    const preview_code = previewInternalCode({ rules, plantCode, sequence: 1 })
    return NextResponse.json({
      preview_code,
      auto_generate: false,
      id_rules: rules,
      plant_code: plantCode,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
