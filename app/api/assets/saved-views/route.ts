import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_saved_views')
      .select('id, user_id, name, scope, config, is_shared, created_at, updated_at')
      .or(`user_id.eq.${user.id},is_shared.eq.true`)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error(error)
      return NextResponse.json({ views: [] })
    }

    return NextResponse.json({ views: data ?? [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const name = String(body.name ?? '').trim()
    const config = body.config ?? {}
    if (!name) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_saved_views')
      .insert({
        user_id: user.id,
        name,
        scope: 'personal',
        config,
        is_shared: false,
      })
      .select('id')
      .single()

    if (error) {
      console.error(error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data?.id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
