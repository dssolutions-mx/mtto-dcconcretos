import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import type { CreateTireInput } from '@/types/tires'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let q = supabase
      .from('tires')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) q = q.eq('status', status)

    const { data, error } = await q
    if (error) {
      console.error('[tires] list', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tires: data ?? [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
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

    const body = (await request.json()) as CreateTireInput
    if (!body.brand?.trim() || !body.size?.trim()) {
      return NextResponse.json({ error: 'Marca y medida son obligatorias' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('tires')
      .insert({
        serial_number: body.serial_number?.trim() || null,
        brand: body.brand.trim(),
        model: body.model?.trim() || null,
        size: body.size.trim(),
        condition: body.condition ?? 'nueva',
        purchase_cost: body.purchase_cost ?? null,
        purchase_date: body.purchase_date ?? null,
        min_tread_mm: body.min_tread_mm ?? 3.0,
        notes: body.notes?.trim() || null,
        status: 'en_almacen',
      })
      .select()
      .single()

    if (error) {
      console.error('[tires] create', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tire: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
