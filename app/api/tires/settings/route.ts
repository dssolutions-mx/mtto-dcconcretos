import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import type { UpsertTireFleetSettingsInput } from '@/types/tires'

const DEFAULT_SETTINGS = {
  id_rules: {},
  thresholds: {},
  checklist_defaults: {},
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const plantId = request.nextUrl.searchParams.get('plant_id')

    let query = supabase.from('tire_fleet_settings').select('*')

    if (plantId) {
      query = query.eq('plant_id', plantId)
    } else {
      query = query.is('plant_id', null)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error('[tires/settings] GET', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        settings: {
          plant_id: plantId ?? null,
          ...DEFAULT_SETTINGS,
        },
      })
    }

    return NextResponse.json({ settings: data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = (await request.json()) as UpsertTireFleetSettingsInput
    const plantId = body.plant_id ?? null

    const row = {
      plant_id: plantId,
      id_rules: body.id_rules ?? DEFAULT_SETTINGS.id_rules,
      thresholds: body.thresholds ?? DEFAULT_SETTINGS.thresholds,
      checklist_defaults: body.checklist_defaults ?? DEFAULT_SETTINGS.checklist_defaults,
      updated_at: new Date().toISOString(),
    }

    const { data: existing } = plantId
      ? await supabase
          .from('tire_fleet_settings')
          .select('id')
          .eq('plant_id', plantId)
          .maybeSingle()
      : await supabase
          .from('tire_fleet_settings')
          .select('id')
          .is('plant_id', null)
          .maybeSingle()

    if (existing) {
      const { data, error } = await supabase
        .from('tire_fleet_settings')
        .update(row)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[tires/settings] PUT update', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ settings: data })
    }

    const { data, error } = await supabase
      .from('tire_fleet_settings')
      .insert(row)
      .select()
      .single()

    if (error) {
      console.error('[tires/settings] PUT insert', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
