import { createClient } from '@/lib/supabase-server'
import { resolvePositionsFromLayout } from '@/lib/tires/layout-resolver'
import { NextRequest, NextResponse } from 'next/server'
import type { TireLayoutTemplateKey, TireOnboardingStep } from '@/types/tires'

const VALID_STEPS: TireOnboardingStep[] = [
  'scope',
  'layouts',
  'id_rules',
  'inventory',
  'pilot',
]

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

    let progressQuery = supabase
      .from('tire_onboarding_progress')
      .select('*')
      .order('step')

    if (plantId) {
      progressQuery = progressQuery.eq('plant_id', plantId)
    } else {
      progressQuery = progressQuery.is('plant_id', null)
    }

    const [{ data: progress, error: progressErr }, { data: models }, { data: plants }] =
      await Promise.all([
        progressQuery,
        supabase
          .from('equipment_models')
          .select('id, name, category, manufacturer')
          .order('name'),
        supabase.from('plants').select('id, name, code').order('name'),
      ])

    if (progressErr) {
      console.error('[tires/onboarding] GET progress', progressErr)
      return NextResponse.json({ error: progressErr.message }, { status: 500 })
    }

    const modelIds = (models ?? []).map((m) => m.id)
    const { data: layouts } =
      modelIds.length > 0
        ? await supabase
            .from('equipment_model_tire_layouts')
            .select('model_id, template_key, positions, svg_variant')
            .in('model_id', modelIds)
        : { data: [] }

    const layoutByModel = new Map((layouts ?? []).map((l) => [l.model_id, l]))

    const modelsWithLayout = (models ?? []).map((model) => {
      const layout = layoutByModel.get(model.id)
      const resolved_positions = layout
        ? resolvePositionsFromLayout({
            template_key: (layout.template_key ?? 'truck_6x4') as TireLayoutTemplateKey,
            positions: layout.positions,
            svg_variant: layout.svg_variant ?? 'v1',
          })
        : null

      return {
        ...model,
        layout: layout ?? null,
        resolved_positions,
        position_count: resolved_positions?.length ?? 0,
      }
    })

    const { data: assets } = await supabase
      .from('assets')
      .select('id, name, asset_id, model_id, plant_id, equipment_models(name, category)')
      .not('model_id', 'is', null)
      .order('name')

    const categories = [
      ...new Set(
        (models ?? [])
          .map((m) => m.category?.trim())
          .filter((c): c is string => !!c)
      ),
    ].sort()

    return NextResponse.json({
      progress: progress ?? [],
      context: {
        plants: plants ?? [],
        models: modelsWithLayout,
        assets: assets ?? [],
        categories,
      },
    })
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

    const body = (await request.json()) as {
      plant_id?: string | null
      step: TireOnboardingStep
      payload?: Record<string, unknown>
      completed?: boolean
    }

    if (!body.step || !VALID_STEPS.includes(body.step)) {
      return NextResponse.json({ error: 'Paso inválido' }, { status: 400 })
    }

    const plantId = body.plant_id ?? null
    const row = {
      plant_id: plantId,
      step: body.step,
      payload: body.payload ?? {},
      completed_at: body.completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    const existingQuery = plantId
      ? supabase
          .from('tire_onboarding_progress')
          .select('id')
          .eq('plant_id', plantId)
          .eq('step', body.step)
          .maybeSingle()
      : supabase
          .from('tire_onboarding_progress')
          .select('id')
          .is('plant_id', null)
          .eq('step', body.step)
          .maybeSingle()

    const { data: existing } = await existingQuery

    if (existing) {
      const { data, error } = await supabase
        .from('tire_onboarding_progress')
        .update(row)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[tires/onboarding] PUT update', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ progress: data })
    }

    const { data, error } = await supabase
      .from('tire_onboarding_progress')
      .insert(row)
      .select()
      .single()

    if (error) {
      console.error('[tires/onboarding] PUT insert', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ progress: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
