import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import {
  issueTireFromInventory,
  returnTireToInventory,
} from '@/lib/tires/inventory-integration'
import type { MountTireInput, TireReadingInput } from '@/types/tires'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: assetId } = await context.params

    const { data: asset, error: assetErr } = await supabase
      .from('assets')
      .select('id, name, current_kilometers, current_hours')
      .eq('id', assetId)
      .maybeSingle()

    if (assetErr) return NextResponse.json({ error: assetErr.message }, { status: 500 })
    if (!asset) return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })

    const { data: installations, error: instErr } = await supabase
      .from('asset_tire_installations')
      .select('*, tire:tires(*)')
      .eq('asset_id', assetId)
      .order('installed_at', { ascending: false })

    if (instErr) {
      console.error('[asset-tires] list', instErr)
      return NextResponse.json({ error: instErr.message }, { status: 500 })
    }

    const activeIds = (installations ?? [])
      .filter((i) => !i.removed_at)
      .map((i) => i.id)

    let latestReadings: Record<string, unknown> = {}
    if (activeIds.length > 0) {
      const { data: readings } = await supabase
        .from('tire_readings')
        .select('*')
        .in('installation_id', activeIds)
        .order('read_at', { ascending: false })

      for (const r of readings ?? []) {
        if (!latestReadings[r.installation_id as string]) {
          latestReadings[r.installation_id as string] = r
        }
      }
    }

    const enriched = (installations ?? []).map((inst) => ({
      ...inst,
      latest_reading: latestReadings[inst.id] ?? null,
    }))

    const { data: events } = await supabase
      .from('tire_events')
      .select('*')
      .eq('asset_id', assetId)
      .order('event_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      asset,
      installations: enriched,
      events: events ?? [],
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: assetId } = await context.params
    const body = (await request.json()) as MountTireInput

    if (!body.tire_id || !body.position_code || !body.position_label) {
      return NextResponse.json({ error: 'Datos de montaje incompletos' }, { status: 400 })
    }

    const { data: asset, error: assetErr } = await supabase
      .from('assets')
      .select('id, current_kilometers, current_hours')
      .eq('id', assetId)
      .maybeSingle()

    if (assetErr) return NextResponse.json({ error: assetErr.message }, { status: 500 })
    if (!asset) return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })

    const { data: tire, error: tireErr } = await supabase
      .from('tires')
      .select('id, status')
      .eq('id', body.tire_id)
      .maybeSingle()

    if (tireErr) return NextResponse.json({ error: tireErr.message }, { status: 500 })
    if (!tire) return NextResponse.json({ error: 'Llanta no encontrada' }, { status: 404 })
    if (tire.status === 'montada') {
      return NextResponse.json({ error: 'La llanta ya está montada en otro activo' }, { status: 409 })
    }
    if (tire.status === 'baja') {
      return NextResponse.json({ error: 'La llanta está dada de baja' }, { status: 409 })
    }

    const { data: existingAtPosition } = await supabase
      .from('asset_tire_installations')
      .select('id')
      .eq('asset_id', assetId)
      .eq('position_code', body.position_code)
      .is('removed_at', null)
      .maybeSingle()

    if (existingAtPosition) {
      return NextResponse.json(
        { error: 'Ya hay una llanta montada en esa posición. Desmonte primero.' },
        { status: 409 }
      )
    }

    const { data: installation, error: instErr } = await supabase
      .from('asset_tire_installations')
      .insert({
        tire_id: body.tire_id,
        asset_id: assetId,
        position_code: body.position_code,
        position_label: body.position_label,
        axle_number: body.axle_number ?? null,
        km_at_install: asset.current_kilometers,
        hours_at_install: asset.current_hours,
        installed_by: user.id,
        work_order_id: body.work_order_id ?? null,
        notes: body.notes?.trim() || null,
      })
      .select('*, tire:tires(*)')
      .single()

    if (instErr) {
      console.error('[asset-tires] mount', instErr)
      return NextResponse.json({ error: instErr.message }, { status: 500 })
    }

    await issueTireFromInventory(supabase, {
      tire_id: body.tire_id,
      work_order_id: body.work_order_id ?? null,
      user_id: user.id,
      notes: `Montaje en ${body.position_label}`,
    })

    await supabase.from('tires').update({ status: 'montada', updated_at: new Date().toISOString() }).eq('id', body.tire_id)

    await supabase.from('tire_events').insert({
      tire_id: body.tire_id,
      installation_id: installation.id,
      asset_id: assetId,
      event_type: 'montaje',
      work_order_id: body.work_order_id ?? null,
      odometer_km: asset.current_kilometers,
      horometer_hours: asset.current_hours,
      to_position: body.position_code,
      created_by: user.id,
      notes: body.notes?.trim() || null,
    })

    return NextResponse.json({ installation }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: assetId } = await context.params
    const body = await request.json() as {
      action: 'unmount' | 'reading' | 'event'
      installation_id?: string
      reading?: TireReadingInput
      event_type?: string
      cost?: number
      notes?: string
      retire_tire?: boolean
      work_order_id?: string
    }

    if (body.action === 'reading' && body.reading) {
      const { data: inst, error: instErr } = await supabase
        .from('asset_tire_installations')
        .select('id, tire_id, asset_id')
        .eq('id', body.reading.installation_id)
        .eq('asset_id', assetId)
        .is('removed_at', null)
        .maybeSingle()

      if (instErr || !inst) {
        return NextResponse.json({ error: 'Instalación no encontrada' }, { status: 404 })
      }

      const { data: asset } = await supabase
        .from('assets')
        .select('current_kilometers, current_hours')
        .eq('id', assetId)
        .single()

      const { data: reading, error: readErr } = await supabase
        .from('tire_readings')
        .insert({
          installation_id: inst.id,
          tire_id: inst.tire_id,
          asset_id: assetId,
          tread_depth_mm: body.reading.tread_depth_mm ?? null,
          pressure_psi: body.reading.pressure_psi ?? null,
          odometer_km: asset?.current_kilometers ?? null,
          horometer_hours: asset?.current_hours ?? null,
          recorded_by: user.id,
          notes: body.reading.notes?.trim() || null,
        })
        .select()
        .single()

      if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
      return NextResponse.json({ reading })
    }

    if (body.action === 'unmount' && body.installation_id) {
      const { data: inst, error: instErr } = await supabase
        .from('asset_tire_installations')
        .select('*, tire:tires(*)')
        .eq('id', body.installation_id)
        .eq('asset_id', assetId)
        .is('removed_at', null)
        .maybeSingle()

      if (instErr || !inst) {
        return NextResponse.json({ error: 'Instalación activa no encontrada' }, { status: 404 })
      }

      const { data: asset } = await supabase
        .from('assets')
        .select('current_kilometers, current_hours')
        .eq('id', assetId)
        .single()

      const now = new Date().toISOString()
      const { error: updateErr } = await supabase
        .from('asset_tire_installations')
        .update({
          removed_at: now,
          km_at_remove: asset?.current_kilometers ?? null,
          hours_at_remove: asset?.current_hours ?? null,
        })
        .eq('id', body.installation_id)

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

      const newStatus = body.retire_tire ? 'baja' : 'en_almacen'
      await supabase
        .from('tires')
        .update({ status: newStatus, updated_at: now })
        .eq('id', inst.tire_id)

      if (!body.retire_tire) {
        await returnTireToInventory(supabase, {
          tire_id: inst.tire_id,
          work_order_id: body.work_order_id ?? inst.work_order_id ?? null,
          user_id: user.id,
          notes: `Desmontaje de ${inst.position_label}`,
        })
      }

      await supabase.from('tire_events').insert({
        tire_id: inst.tire_id,
        installation_id: inst.id,
        asset_id: assetId,
        event_type: body.retire_tire ? 'baja' : 'desmontaje',
        work_order_id: body.work_order_id ?? inst.work_order_id ?? null,
        odometer_km: asset?.current_kilometers ?? null,
        horometer_hours: asset?.current_hours ?? null,
        from_position: inst.position_code,
        cost: body.cost ?? null,
        created_by: user.id,
        notes: body.notes?.trim() || null,
      })

      return NextResponse.json({ success: true })
    }

    if (body.action === 'event' && body.installation_id) {
      const { data: inst } = await supabase
        .from('asset_tire_installations')
        .select('tire_id')
        .eq('id', body.installation_id)
        .eq('asset_id', assetId)
        .maybeSingle()

      if (!inst) return NextResponse.json({ error: 'Instalación no encontrada' }, { status: 404 })

      const { data: asset } = await supabase
        .from('assets')
        .select('current_kilometers, current_hours')
        .eq('id', assetId)
        .single()

      const { data: event, error: evErr } = await supabase
        .from('tire_events')
        .insert({
          tire_id: inst.tire_id,
          installation_id: body.installation_id,
          asset_id: assetId,
          event_type: body.event_type ?? 'reparacion',
          work_order_id: body.work_order_id ?? null,
          cost: body.cost ?? null,
          odometer_km: asset?.current_kilometers ?? null,
          horometer_hours: asset?.current_hours ?? null,
          created_by: user.id,
          notes: body.notes?.trim() || null,
        })
        .select()
        .single()

      if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 })
      return NextResponse.json({ event })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
