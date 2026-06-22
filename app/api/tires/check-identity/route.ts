import { createClient } from '@/lib/supabase-server'
import { checkTireIdentity } from '@/lib/tires/check-tire-identity'
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

    const dot = request.nextUrl.searchParams.get('dot')?.trim() || null
    const internalCode = request.nextUrl.searchParams.get('internal_code')?.trim() || null

    if (!dot && !internalCode) {
      return NextResponse.json(
        { error: 'Indique dot y/o internal_code para verificar' },
        { status: 400 }
      )
    }

    const result = await checkTireIdentity(supabase, {
      dot,
      internal_code: internalCode,
    })

    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
