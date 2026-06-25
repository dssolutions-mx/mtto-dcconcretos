import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext } from '@/lib/auth/server-authorization'
import {
  canAccessCleanlinessPrefill,
  fetchOperatorCleanlinessPrefill,
} from '@/lib/hr/cleanliness-prefill'

/**
 * Per-operator cleanliness prefill for bonus_closure sections.
 * Query: plant_id, year, month (1-12)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const plantId = searchParams.get('plant_id') ?? actor.profile.plant_id
    const year = Number(searchParams.get('year') ?? new Date().getUTCFullYear())
    const month = Number(searchParams.get('month') ?? new Date().getUTCMonth() + 1)

    if (!plantId) {
      return NextResponse.json({ error: 'plant_id requerido' }, { status: 400 })
    }
    if (!year || month < 1 || month > 12) {
      return NextResponse.json({ error: 'year/month inválidos' }, { status: 400 })
    }

    const access = canAccessCleanlinessPrefill(actor, plantId)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const operators = await fetchOperatorCleanlinessPrefill(supabase, {
      plantId,
      year,
      month,
    })

    return NextResponse.json({ operators })
  } catch (error) {
    console.error('[cleanliness-prefill]', error)
    return NextResponse.json(
      { error: 'Error al obtener prellenado de limpieza' },
      { status: 500 }
    )
  }
}
