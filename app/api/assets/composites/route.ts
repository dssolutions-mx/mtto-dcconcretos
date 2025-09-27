import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      composite_type,
      component_ids,
      primary_component_id,
      asset_id, // optional custom code
      initial_shared_hours,
      initial_shared_kilometers,
      asset_id_strategy,
      asset_id_prefix,
    }: {
      name: string
      composite_type?: string
      component_ids: string[]
      primary_component_id?: string
      asset_id?: string
      initial_shared_hours?: number
      initial_shared_kilometers?: number
      asset_id_strategy?: 'auto' | 'error'
      asset_id_prefix?: string
    } = body

    if (!name || !Array.isArray(component_ids) || component_ids.length < 2) {
      return NextResponse.json(
        { error: 'name and at least two component_ids are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Ensure none of the components are already part of another composite (active)
    const { data: existingRelations, error: relError } = await supabase
      .from('asset_composite_relationships')
      .select('component_asset_id, status')
      .in('component_asset_id', component_ids)
      .eq('status', 'active')

    if (relError) {
      return NextResponse.json({ error: relError.message }, { status: 500 })
    }

    if (existingRelations && existingRelations.length > 0) {
      return NextResponse.json(
        { error: 'One or more selected components are already part of an active composite' },
        { status: 409 }
      )
    }

    // Helper to attempt insert with given code
    async function tryInsert(withCode: string) {
      return await supabase
        .from('assets')
        .insert({
          name,
          asset_id: withCode,
          is_new: false,
          is_composite: true,
          component_assets: component_ids,
          composite_type: composite_type ?? 'pumping_truck',
          primary_component_id: primary_component_id ?? null,
          status: 'operational',
          current_hours: initial_shared_hours ?? undefined,
          current_kilometers: initial_shared_kilometers ?? undefined,
        })
        .select('*')
        .single()
    }

    // First attempt with provided (or name) code
    let desiredCode = asset_id ?? name
    let insertAttempt = await tryInsert(desiredCode)
    let composite = insertAttempt.data
    let createError = insertAttempt.error as any

    // If duplicate key and strategy allows auto, generate and retry a few times
    if (createError && createError.code === '23505' && asset_id_strategy === 'auto') {
      const prefix = asset_id_prefix || (composite_type === 'pumping_truck' ? 'PT-' : 'COMP-')
      for (let i = 0; i < 3; i++) {
        const { data: newIdData, error: genError } = await supabase.rpc('generate_next_id', { prefix })
        if (genError || !newIdData) break
        desiredCode = newIdData as unknown as string
        insertAttempt = await tryInsert(desiredCode)
        composite = insertAttempt.data
        createError = insertAttempt.error as any
        if (!createError) break
      }
    }

    if (createError) {
      // Duplicate key handling surfaced clearly to UI
      if ((createError as any).code === '23505') {
        return NextResponse.json({
          error: 'DUPLICATE_ASSET_ID',
          message: 'El código de activo (asset_id) ya existe. Use un código único o seleccione la opción de generación automática.',
          details: { field: 'asset_id' }
        }, { status: 409 })
      }
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Insert relationships
    const relationships = component_ids.map((cid: string) => ({
      composite_asset_id: composite.id,
      component_asset_id: cid,
      status: 'active' as const,
    }))

    const { error: relInsertError } = await supabase
      .from('asset_composite_relationships')
      .insert(relationships)

    if (relInsertError) {
      return NextResponse.json({ error: relInsertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: composite })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Unexpected error' }, { status: 500 })
  }
}
