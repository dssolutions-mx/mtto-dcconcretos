import { createClient } from '@/lib/supabase-server'
import {
  canFleetVerify,
  canEditAssetAtPlant,
  type FleetActor,
} from '@/lib/fleet/fleet-api-auth'
import { TRACKED_TRUST_FIELDS } from '@/lib/fleet/trust-server'
import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

function hashValue(val: string) {
  return createHash('sha256').update(val ?? '').digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id, role, plant_id, business_unit_id, status')
      .eq('id', user.id)
      .single()

    if (profErr || !profile || profile.status !== 'active') {
      return NextResponse.json({ error: 'Perfil no encontrado o inactivo' }, { status: 403 })
    }

    const { data: managedIds } = await supabase.rpc('profile_scoped_plant_ids', {
      p_user_id: user.id,
    })

    const actor: FleetActor = {
      id: profile.id,
      role: profile.role,
      business_unit_id: profile.business_unit_id,
      plant_id: profile.plant_id,
      managed_plant_ids: Array.isArray(managedIds) ? managedIds : undefined,
    }

    if (!canFleetVerify(actor)) {
      return NextResponse.json({ error: 'Sin permiso para confirmar datos' }, { status: 403 })
    }

    const body = await request.json()
    const scope = body.scope as 'field' | 'node'

    async function ensurePlantScope(assetId: string) {
      const { data: row } = await supabase
        .from('assets')
        .select(
          `
          plant_id,
          plants:plant_id ( business_unit_id )
        `
        )
        .eq('id', assetId)
        .single()

      const plant = row?.plants as { business_unit_id: string | null } | null
      const buId = Array.isArray(plant) ? plant[0]?.business_unit_id : plant?.business_unit_id
      if (
        !canEditAssetAtPlant(actor, row?.plant_id ?? null, buId ?? null)
      ) {
        throw new Error('Fuera de alcance para este activo')
      }
    }

    if (scope === 'field') {
      const assetId = body.asset_id as string
      const field = body.field as string
      if (!assetId || !field || !TRACKED_TRUST_FIELDS.includes(field as typeof TRACKED_TRUST_FIELDS[number])) {
        return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
      }
      await ensurePlantScope(assetId)

      const { data: asset } = await supabase
        .from('assets')
        .select(
          'model_id, plant_id, status, current_hours, current_kilometers, serial_number, insurance_end_date'
        )
        .eq('id', assetId)
        .single()

      const vals: Record<string, string> = {
        model_id: String(asset?.model_id ?? ''),
        plant_id: String(asset?.plant_id ?? ''),
        status: String(asset?.status ?? ''),
        current_hours: String(asset?.current_hours ?? ''),
        current_kilometers: String(asset?.current_kilometers ?? ''),
        serial_number: String(asset?.serial_number ?? ''),
        insurance_end_date: String(
          (asset as { insurance_end_date?: string | null })?.insurance_end_date ?? ''
        ),
      }
      const vhash = hashValue(vals[field] ?? '')

      const { error: upErr } = await supabase.from('asset_field_verifications').upsert(
        {
          asset_id: assetId,
          field,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          value_hash: vhash,
        },
        { onConflict: 'asset_id,field' }
      )

      if (upErr) {
        console.error(upErr)
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    if (scope === 'node') {
      const assetIds = body.asset_ids as string[]
      if (!Array.isArray(assetIds) || assetIds.length === 0) {
        return NextResponse.json({ error: 'asset_ids requerido' }, { status: 400 })
      }

      for (const aid of assetIds) {
        await ensurePlantScope(aid)
      }

      const rows: {
        asset_id: string
        field: string
        verified_by: string
        verified_at: string
        value_hash: string
      }[] = []

      for (const assetId of assetIds) {
        const { data: asset } = await supabase
          .from('assets')
          .select(
            'model_id, plant_id, status, current_hours, current_kilometers, serial_number, insurance_end_date'
          )
          .eq('id', assetId)
          .single()

        const vals: Record<string, string> = {
          model_id: String(asset?.model_id ?? ''),
          plant_id: String(asset?.plant_id ?? ''),
          status: String(asset?.status ?? ''),
          current_hours: String(asset?.current_hours ?? ''),
          current_kilometers: String(asset?.current_kilometers ?? ''),
          serial_number: String(asset?.serial_number ?? ''),
          insurance_end_date: String(
            (asset as { insurance_end_date?: string | null })?.insurance_end_date ?? ''
          ),
        }

        for (const field of TRACKED_TRUST_FIELDS) {
          rows.push({
            asset_id: assetId,
            field,
            verified_by: user.id,
            verified_at: new Date().toISOString(),
            value_hash: hashValue(vals[field] ?? ''),
          })
        }
      }

      const { error: upErr } = await supabase.from('asset_field_verifications').upsert(rows, {
        onConflict: 'asset_id,field',
      })

      if (upErr) {
        console.error(upErr)
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, count: rows.length })
    }

    return NextResponse.json({ error: 'scope inválido' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
