import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('asset_conflicts')
      .select('conflict_type, severity, asset_id, equipment_model_id, payload, detail')
      .order('severity', { ascending: false })

    if (error) {
      console.error('asset_conflicts', error)
      return NextResponse.json({ conflicts: [], error: error.message })
    }

    return NextResponse.json({ conflicts: data ?? [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
