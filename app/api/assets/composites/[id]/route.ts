import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch composite asset
    const { data: composite, error: compError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .eq('is_composite', true)
      .single()

    if (compError) {
      return NextResponse.json({ error: compError.message }, { status: 404 })
    }

    // Fetch components
    const componentIds = Array.isArray(composite.component_assets)
      ? composite.component_assets
      : []

    let components: any[] = []
    if (componentIds.length > 0) {
      const { data: comps, error: compsError } = await supabase
        .from('assets')
        .select('*')
        .in('id', componentIds)

      if (compsError) {
        return NextResponse.json({ error: compsError.message }, { status: 500 })
      }
      components = comps ?? []
    }

    return NextResponse.json({ success: true, data: { composite, components } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Unexpected error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      attach_ids = [],
      detach_ids = [],
      primary_component_id,
    }: {
      attach_ids?: string[]
      detach_ids?: string[]
      primary_component_id?: string | null
    } = body

    const supabase = await createClient()

    // Fetch current composite
    const { data: composite, error: compError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .eq('is_composite', true)
      .single()

    if (compError || !composite) {
      return NextResponse.json({ error: compError?.message ?? 'Composite not found' }, { status: 404 })
    }

    const currentIds: string[] = Array.isArray(composite.component_assets)
      ? composite.component_assets
      : []

    // Validate detach: only those currently present
    const validDetach = (detach_ids || []).filter((x) => currentIds.includes(x))

    // Apply changes to array
    const nextIds = Array.from(
      new Set([...currentIds.filter((x) => !validDetach.includes(x)), ...(attach_ids || [])])
    )

    // Update composite record
    const { data: updated, error: updateError } = await supabase
      .from('assets')
      .update({
        component_assets: nextIds,
        primary_component_id: primary_component_id ?? composite.primary_component_id ?? null,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Update relationships: detach -> set status=detached; attach -> insert if missing
    if (validDetach.length > 0) {
      const { error: detachError } = await supabase
        .from('asset_composite_relationships')
        .update({ status: 'detached', detachment_date: new Date().toISOString().slice(0, 10) })
        .eq('composite_asset_id', id)
        .in('component_asset_id', validDetach)
        .eq('status', 'active')
      if (detachError) {
        return NextResponse.json({ error: detachError.message }, { status: 500 })
      }
    }

    const attachInsert = (attach_ids || [])
      .filter((x) => !currentIds.includes(x))
      .map((cid) => ({ composite_asset_id: id, component_asset_id: cid, status: 'active' as const }))

    if (attachInsert.length > 0) {
      const { error: attachError } = await supabase
        .from('asset_composite_relationships')
        .insert(attachInsert)
      if (attachError) {
        return NextResponse.json({ error: attachError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Unexpected error' }, { status: 500 })
  }
}
