import { createClient } from '@/lib/supabase-server'
import { checkTireIdentity } from '@/lib/tires/check-tire-identity'
import { insertTireWithIdentity } from '@/lib/tires/identifier'
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

    const identityCheck = await checkTireIdentity(supabase, {
      dot: body.serial_number ?? null,
      internal_code: body.internal_code ?? null,
    })

    if (identityCheck.dot?.state === 'duplicate') {
      return NextResponse.json(
        { error: identityCheck.dot.message ?? 'Este DOT ya está registrado' },
        { status: 409 }
      )
    }

    if (identityCheck.internal_code?.state === 'duplicate') {
      return NextResponse.json(
        {
          error:
            identityCheck.internal_code.message ?? 'Este código de flota ya está en uso',
        },
        { status: 409 }
      )
    }

    const created = await insertTireWithIdentity(
      supabase,
      {
        brand: body.brand.trim(),
        model: body.model?.trim() || null,
        size: body.size.trim(),
        condition: body.condition ?? 'nueva',
        purchase_cost: body.purchase_cost ?? null,
        purchase_date: body.purchase_date ?? null,
        min_tread_mm: body.min_tread_mm ?? 3.0,
        notes: body.notes?.trim() || null,
        plant_id: body.plant_id ?? null,
        warehouse_id: body.warehouse_id ?? null,
        status: 'en_almacen',
      },
      {
        plantId: body.plant_id ?? null,
        serialNumber: body.serial_number ?? null,
        internalCode: body.internal_code ?? null,
      }
    )

    const { data, error } = await supabase
      .from('tires')
      .select('*')
      .eq('id', created.id)
      .single()

    if (error) {
      console.error('[tires] create fetch', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tire: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    if (
      msg.includes('internal_code') ||
      msg.includes('idx_tires_internal_code') ||
      msg.includes('23505')
    ) {
      return NextResponse.json(
        { error: 'El código interno ya existe. Use otro código o active la auto-generación.' },
        { status: 409 }
      )
    }
    if (msg.includes('DOT / serial') || msg.includes('Indique DOT')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
