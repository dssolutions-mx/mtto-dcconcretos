import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { insertAssetAuditLog } from '@/lib/fleet/audit'
import {
  canFleetEdit,
  canEditAssetAtPlant,
  type FleetActor,
} from '@/lib/fleet/fleet-api-auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase-types'
import {
  executeAssetPlantReassignment,
  type DbClient,
} from '@/lib/assets/execute-asset-plant-reassignment'
import { NextRequest, NextResponse } from 'next/server'

type FleetAssetBefore = {
  id: string
  plant_id: string | null
  model_id: string | null
  status: string | null
  current_hours: number | null
  current_kilometers: number | null
  fabrication_year: number | null
  serial_number: string | null
  department_id: string | null
  location: string | null
  notes: string | null
  plants:
    | { business_unit_id: string | null }
    | { business_unit_id: string | null }[]
    | null
}

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

    const { data: rawProfile } = await supabase
      .from('profiles')
      .select('id, role, plant_id, business_unit_id, status')
      .eq('id', user.id)
      .single()

    const profile = rawProfile as {
      id: string
      role: string
      plant_id: string | null
      business_unit_id: string | null
      status: string | null
    } | null

    if (!profile || profile.status !== 'active') {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })
    }

    const actor: FleetActor = {
      id: profile.id,
      role: profile.role,
      business_unit_id: profile.business_unit_id,
      plant_id: profile.plant_id,
    }

    const auditDb = supabase as unknown as SupabaseClient<Database>

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

    const adminClient = createAdminClient() as DbClient
    const otherKeys = keys.filter((k) => k !== 'plant_id')
    const plantKeyPresent = keys.includes('plant_id')

    for (const assetId of asset_ids) {
      const { data: beforeRaw } = await supabase
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

      if (!beforeRaw) {
        return NextResponse.json({ error: `Activo ${assetId} no encontrado` }, { status: 404 })
      }

      const before = beforeRaw as FleetAssetBefore

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

      if (plantKeyPresent) {
        const rawNew = patch.plant_id
        const normalizedNew =
          rawNew === '' || rawNew === undefined ? null : String(rawNew)
        const oldPid = before.plant_id ?? null

        if (String(normalizedNew ?? '') !== String(oldPid ?? '')) {
          if (normalizedNew) {
            const { data: destPlantRaw } = await supabase
              .from('plants')
              .select('business_unit_id')
              .eq('id', normalizedNew)
              .single()

            const destPlantRow = destPlantRaw as { business_unit_id: string | null } | null

            if (!destPlantRow) {
              return NextResponse.json({ error: 'Planta destino no encontrada' }, { status: 404 })
            }
            if (
              !canEditAssetAtPlant(
                actor,
                normalizedNew,
                destPlantRow.business_unit_id ?? null
              )
            ) {
              return NextResponse.json(
                { error: 'Sin permiso sobre la planta destino para uno o más activos' },
                { status: 403 }
              )
            }
          }

          const move = await executeAssetPlantReassignment({
            supabase: supabase as DbClient,
            adminClient,
            userId: user.id,
            actor: {
              role: profile.role,
              plant_id: profile.plant_id,
              business_unit_id: profile.business_unit_id,
            },
            assetId,
            plantId: normalizedNew,
            notes: 'Actualización masiva de flota (plant_id)',
            resolveConflicts: undefined,
            autoTransferOperatorsWhenPossible: true,
          })

          if (!move.ok) {
            const baseError =
              move.status === 409 || move.status === 400
                ? 'Este activo tiene operadores asignados que requieren decisión explícita. Usa Gestión → Asignación de plantas (o desasigna operadores antes).'
                : (typeof move.body.error === 'string' ? move.body.error : null) ??
                  'Error al mover planta del activo'
            return NextResponse.json(
              {
                error: baseError,
                asset_id: assetId,
                ...move.body,
              },
              { status: move.status }
            )
          }

          const err = await insertAssetAuditLog(auditDb, {
            asset_id: assetId,
            user_id: user.id,
            field: 'plant_id',
            before_value: oldPid == null ? '' : String(oldPid),
            after_value: normalizedNew == null ? '' : String(normalizedNew),
            source: 'fleet_bulk',
          })
          if (err) console.warn('audit log', err)
        }
      }

      if (otherKeys.length === 0) {
        continue
      }

      const updatePayload: Record<string, unknown> = {}
      for (const k of otherKeys) {
        updatePayload[k] = patch[k]
      }

      const fleetPatch = {
        ...updatePayload,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }
      const { error: updErr } = await supabase
        .from('assets')
        // Dynamic keys from PATCHABLE; Supabase client infers `update` as unavailable for this chain.
        .update(fleetPatch as never)
        .eq('id', assetId)

      if (updErr) {
        console.error(updErr)
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }

      for (const k of otherKeys) {
        const b = (before as Record<string, unknown>)[k]
        const a = patch[k]
        const bStr = b == null ? '' : String(b)
        const aStr = a == null ? '' : String(a)
        if (bStr === aStr) continue
        const err = await insertAssetAuditLog(auditDb, {
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
