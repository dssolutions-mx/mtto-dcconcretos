import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { runIngresosGastosPost } from '@/lib/reports/ingresos-gastos-compute'

/** Cold full compute can exceed the default 10s function limit on Vercel. */
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const payload = await runIngresosGastosPost({
      body,
      supabase,
      requestHost: req.headers.get('host'),
      rollupReadUserKey: user?.id ?? 'anonymous',
    })
    return NextResponse.json(payload)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    console.error('Ingresos-Gastos API error:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
