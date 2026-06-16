import { createClient } from '@/lib/supabase-server'
import { computeAssetTireSubState } from '@/lib/tires/fleet-status'
import { getPositionsForAsset } from '@/lib/tires/layout-resolver'
import { enrichInstallationsWithReadings } from '@/lib/tires/readings'
import { validateRotation } from '@/lib/tires/rotation'
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
      .select('id, name, current_kilometers, current_hours, model_id, equipment_models(id, name, category)')
      .eq('id', assetId)
      .maybeSingle()

    if (assetErr) return NextResponse.json({ error: assetErr.message }, { status: 500 })
    if (!asset) return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })

    const modelId = asset.model_id as string | null
    let hasExplicitLayout = false
    if (modelId) {
      const { data: layoutRow } = await supabase
        .from('equipment_model_tire_layouts')
        .select('id')
        .eq('model_id', modelId)
        .maybeSingle()
      hasExplicitLayout = !!layoutRow
    }

    const resolvedLayout = await getPositionsForAsset(supabase, assetId)

    const { count: warehouseCount } = await supabase
      .from('tires')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'en_almacen')

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
    const tireIds = [...new Set((installations ?? []).map((i) => i.tire_id as string))]

    let allReadings: Record<string, unknown>[] = []
    let rotationEvents: { installation_id: string | null; event_type: string; event_at: string }[] =
      []

    if (activeIds.length > 0 && tireIds.length > 0) {
      const installFilter = `installation_id.in.(${activeIds.join(',')})`
      const tireFilter = `tire_id.in.(${tireIds.join(',')})`
      const [{ data: readings }, { data: rotations }] = await Promise.all([
        supabase
          .from('tire_readings')
          .select('*')
          .or(`${installFilter},${tireFilter}`)
          .order('read_at', { ascending: false }),
        supabase
          .from('tire_events')
          .select('installation_id, event_type, event_at')
          .in('installation_id', activeIds)
          .eq('event_type', 'rotacion'),
      ])
      allReadings = readings ?? []
      rotationEvents = rotations ?? []
    }

    const enriched = enrichInstallationsWithReadings(
      installations ?? [],
      allReadings as Parameters<typeof enrichInstallationsWithReadings>[1],
      rotationEvents
    )

    const { data: events } = await supabase
      .from('tire_events')
      .select('*')
      .eq('asset_id', assetId)
      .order('event_at', { ascending: false })
      .limit(50)

    const active = enriched.filter((i) => !i.removed_at)
    const mountedCount = active.length
    const totalPositions = resolvedLayout.positions.length
    const assetSubState = computeAssetTireSubState({
      hasExplicitLayout,
      hasModel: !!modelId,
      mountedCount,
      totalPositions,
      warehouseCount: warehouseCount ?? 0,
    })

    const equipmentModel = Array.isArray(asset.equipment_models)
      ? asset.equipment_models[0]
      : asset.equipment_models

    return NextResponse.json({
      asset: {
        id: asset.id,
        name: asset.name,
        current_kilometers: asset.current_kilometers,
        current_hours: asset.current_hours,
        model_id: modelId,
        model: equipmentModel ?? null,
      },
      installations: enriched,
      events: events ?? [],
      layout: {
        ...resolvedLayout,
        has_explicit_layout: hasExplicitLayout,
      },
      warehouse_tire_count: warehouseCount ?? 0,
      asset_sub_state: assetSubState,
      coverage: {
        mounted: mountedCount,
        total: totalPositions,
        pct: totalPositions > 0 ? Math.round((mountedCount / totalPositions) * 100) : 0,
      },
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

    try {
      const issueResult = await issueTireFromInventory(supabase, {
        tire_id: body.tire_id,
        work_order_id: body.work_order_id ?? null,
        user_id: user.id,
        notes: `Montaje en ${body.position_label}`,
      })

      if (issueResult.skipped && issueResult.reason === 'not_in_stock') {
        throw new Error('La llanta no está disponible en inventario')
      }

      const { error: statusErr } = await supabase
        .from('tires')
        .update({ status: 'montada', updated_at: new Date().toISOString() })
        .eq('id', body.tire_id)

      if (statusErr) throw statusErr

      const { error: eventErr } = await supabase.from('tire_events').insert({
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

      if (eventErr) throw eventErr

      const { data: tireReadings } = await supabase
        .from('tire_readings')
        .select('*')
        .eq('tire_id', body.tire_id)
        .order('read_at', { ascending: false })

      const mounted = enrichInstallationsWithReadings(
        [installation],
        tireReadings ?? [],
        []
      )[0]

      return NextResponse.json(
        { installation: mounted, needs_pressure_reading: mounted.needs_pressure_reading ?? true },
        { status: 201 }
      )
    } catch (mountErr) {
      await supabase.from('asset_tire_installations').delete().eq('id', installation.id)
      const msg = mountErr instanceof Error ? mountErr.message : 'Error al montar llanta'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
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
      action: 'unmount' | 'reading' | 'event' | 'rotate'
      installation_id?: string
      reading?: TireReadingInput
      event_type?: string
      cost?: number
      notes?: string
      retire_tire?: boolean
      work_order_id?: string
      to_position_code?: string
      to_position_label?: string
      to_axle_number?: number
    }

    if (body.action === 'reading' && body.reading) {
      const { data: inst, error: instErr } = await supabase
        .from('asset_tire_installations')
        .select('id, tire_id, asset_id, position_code')
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
          position_code: inst.position_code,
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

    if (body.action === 'rotate' && body.installation_id) {
      if (!body.to_position_code || !body.to_position_label) {
        return NextResponse.json({ error: 'Posición destino requerida' }, { status: 400 })
      }

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

      const resolvedLayout = await getPositionsForAsset(supabase, assetId)
      const { data: otherActive } = await supabase
        .from('asset_tire_installations')
        .select('position_code')
        .eq('asset_id', assetId)
        .is('removed_at', null)
        .neq('id', body.installation_id)

      const occupied = (otherActive ?? []).map((i) => i.position_code as string)
      const validation = validateRotation({
        from_position_code: inst.position_code as string,
        to_position_code: body.to_position_code,
        occupied_positions: occupied,
        positions: resolvedLayout.positions,
      })

      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 409 })
      }

      const { data: asset } = await supabase
        .from('assets')
        .select('current_kilometers, current_hours')
        .eq('id', assetId)
        .single()

      const { data: updated, error: updateErr } = await supabase
        .from('asset_tire_installations')
        .update({
          position_code: body.to_position_code,
          position_label: body.to_position_label,
          axle_number: body.to_axle_number ?? null,
          notes: body.notes?.trim() || inst.notes,
        })
        .eq('id', body.installation_id)
        .select('*, tire:tires(*)')
        .single()

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      const { error: eventErr } = await supabase.from('tire_events').insert({
        tire_id: inst.tire_id,
        installation_id: inst.id,
        asset_id: assetId,
        event_type: 'rotacion',
        work_order_id: body.work_order_id ?? inst.work_order_id ?? null,
        odometer_km: asset?.current_kilometers ?? null,
        horometer_hours: asset?.current_hours ?? null,
        from_position: inst.position_code,
        to_position: body.to_position_code,
        created_by: user.id,
        notes: body.notes?.trim() || null,
      })

      if (eventErr) {
        return NextResponse.json({ error: eventErr.message }, { status: 500 })
      }

      const [{ data: tireReadings }, { data: rotEvents }] = await Promise.all([
        supabase
          .from('tire_readings')
          .select('*')
          .or(
            `installation_id.eq.${updated.id},tire_id.eq.${updated.tire_id}`
          )
          .order('read_at', { ascending: false }),
        supabase
          .from('tire_events')
          .select('installation_id, event_type, event_at')
          .eq('installation_id', updated.id)
          .eq('event_type', 'rotacion'),
      ])

      const rotated = enrichInstallationsWithReadings(
        [updated],
        tireReadings ?? [],
        rotEvents ?? []
      )[0]

      return NextResponse.json({
        installation: rotated,
        needs_pressure_reading: rotated.needs_pressure_reading ?? true,
      })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
