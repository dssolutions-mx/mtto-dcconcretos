import { createClient } from '@/lib/supabase-server'
import { getNextInternalCode, loadTireIdRules, previewInternalCode } from '@/lib/tires/identifier'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const rules = await loadTireIdRules(supabase, null)

    if (rules.auto_generate) {
      const preview_code = await getNextInternalCode(supabase, rules, null)
      return NextResponse.json({ preview_code, auto_generate: true, id_rules: rules })
    }

    const preview_code = previewInternalCode({ rules, plantCode: 'P1', sequence: 1 })
    return NextResponse.json({ preview_code, auto_generate: false, id_rules: rules })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
