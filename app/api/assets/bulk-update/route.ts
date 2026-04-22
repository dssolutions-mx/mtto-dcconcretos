import { createClient } from '@/lib/supabase-server'
import { insertAssetAuditLog } from '@/lib/fleet/audit'
import {
  canFleetEdit,
  canEditAssetAtPlant,
  type FleetActor,
} from '@/lib/fleet/fleet-api-auth'
import { NextRequest, NextResponse } from 'next/server'

const PATCHABLE = new Set([
  'plant_id',
  'model_id',
  'status',
  'current_hours',
  'current_kilometers',
  'fabrication_year',
  'serial_number',
  'department_id',
  'location',
  'notes',
])

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, plant_id, business_unit_id, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.status !== 'active') {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })
    }

    const actor: FleetActor = {
      id: profile.id,
      role: profile.role,
      business_unit_id: profile.business_unit_id,
      plant_id: profile.plant_id,
    }

    if (!canFleetEdit(actor)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const body = await request.json()
    const asset_ids: string[] = body.asset_ids
    const patch: Record<string, unknown> = body.patch ?? {}

    if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
      return NextResponse.json({ error: 'asset_ids requerido' }, { status: 400 })
    }

    const keys = Object.keys(patch).filter((k) => PATCHABLE.has(k))
    if (keys.length === 0) {
      return NextResponse.json({ error: 'Sin campos válidos' }, { status: 400 })
    }

    for (const assetId of asset_ids) {
      const { data: before } = await supabase
        .from('assets')
        .select(
          `
          id,
          plant_id,
          model_id,
          status,
          current_hours,
          current_kilometers,
          fabrication_year,
          serial_number,
          department_id,
          location,
          notes,
          plants:plant_id ( business_unit_id )
        `
        )
        .eq('id', assetId)
        .single()

      if (!before) {
        return NextResponse.json({ error: `Activo ${assetId} no encontrado` }, { status: 404 })
      }

      const rawPlant = before.plants as
        | { business_unit_id: string | null }
        | { business_unit_id: string | null }[]
        | null
      const plant = Array.isArray(rawPlant) ? rawPlant[0] : rawPlant
      const buId = plant?.business_unit_id ?? null
      if (!canEditAssetAtPlant(actor, before.plant_id, buId ?? null)) {
        return NextResponse.json(
          { error: 'Fuera de alcance para uno o más activos' },
          { status: 403 }
        )
      }

      const updatePayload: Record<string, unknown> = {}
      for (const k of keys) {
        updatePayload[k] = patch[k]
      }

      const { error: updErr } = await supabase
        .from('assets')
        .update({
          ...updatePayload,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assetId)

      if (updErr) {
        console.error(updErr)
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }

      for (const k of keys) {
        const b = (before as Record<string, unknown>)[k]
        const a = patch[k]
        const bStr = b == null ? '' : String(b)
        const aStr = a == null ? '' : String(a)
        if (bStr === aStr) continue
        const err = await insertAssetAuditLog(supabase, {
          asset_id: assetId,
          user_id: user.id,
          field: k,
          before_value: bStr,
          after_value: aStr,
          source: 'fleet_bulk',
        })
        if (err) console.warn('audit log', err)
      }
    }

    return NextResponse.json({ ok: true, updated: asset_ids.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
