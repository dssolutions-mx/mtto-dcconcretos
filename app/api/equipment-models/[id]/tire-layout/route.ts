import { createClient } from '@/lib/supabase-server'
import { resolvePositionsFromLayout } from '@/lib/tires/layout-resolver'
import { NextRequest, NextResponse } from 'next/server'
import type {
  TireLayoutTemplateKey,
  UpsertEquipmentModelTireLayoutInput,
} from '@/types/tires'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: modelId } = await context.params

    const { data: model, error: modelErr } = await supabase
      .from('equipment_models')
      .select('id, name')
      .eq('id', modelId)
      .maybeSingle()

    if (modelErr) return NextResponse.json({ error: modelErr.message }, { status: 500 })
    if (!model) return NextResponse.json({ error: 'Modelo no encontrado' }, { status: 404 })

    const { data: layout, error: layoutErr } = await supabase
      .from('equipment_model_tire_layouts')
      .select('*')
      .eq('model_id', modelId)
      .maybeSingle()

    if (layoutErr) {
      console.error('[equipment-models/tire-layout] GET', layoutErr)
      return NextResponse.json({ error: layoutErr.message }, { status: 500 })
    }

    if (!layout) {
      return NextResponse.json({ layout: null, resolved_positions: null })
    }

    const resolved_positions = resolvePositionsFromLayout({
      template_key: layout.template_key as TireLayoutTemplateKey,
      positions: layout.positions,
      svg_variant: layout.svg_variant,
    })

    return NextResponse.json({ layout, resolved_positions })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: modelId } = await context.params
    const body = (await request.json()) as UpsertEquipmentModelTireLayoutInput

    if (!body.template_key) {
      return NextResponse.json({ error: 'template_key es obligatorio' }, { status: 400 })
    }

    const { data: model, error: modelErr } = await supabase
      .from('equipment_models')
      .select('id')
      .eq('id', modelId)
      .maybeSingle()

    if (modelErr) return NextResponse.json({ error: modelErr.message }, { status: 500 })
    if (!model) return NextResponse.json({ error: 'Modelo no encontrado' }, { status: 404 })

    const row = {
      model_id: modelId,
      template_key: body.template_key,
      positions: body.positions ?? [],
      svg_variant: body.svg_variant ?? 'v1',
      updated_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from('equipment_model_tire_layouts')
      .select('id')
      .eq('model_id', modelId)
      .maybeSingle()

    let layout
    if (existing) {
      const { data, error } = await supabase
        .from('equipment_model_tire_layouts')
        .update(row)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[equipment-models/tire-layout] PUT update', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      layout = data
    } else {
      const { data, error } = await supabase
        .from('equipment_model_tire_layouts')
        .insert(row)
        .select()
        .single()

      if (error) {
        console.error('[equipment-models/tire-layout] PUT insert', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      layout = data
    }

    const resolved_positions = resolvePositionsFromLayout({
      template_key: layout.template_key as TireLayoutTemplateKey,
      positions: layout.positions,
      svg_variant: layout.svg_variant,
    })

    return NextResponse.json({ layout, resolved_positions })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
