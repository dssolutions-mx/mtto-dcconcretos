import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import {
  loadActorContext,
  checkRHOwnershipAuthority,
  managedPlantIdsForProfile,
} from '@/lib/auth/server-authorization'
import { buildPlantOperationsRoster } from '@/lib/hr/plant-operations-roster'

/**
 * Unified plant operations roster for punctuality / bonus closure grids.
 * Query: plant_id (required)
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

    const rhOrGg =
      checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'

    const allowed =
      rhOrGg ||
      actor.profile.role === 'DOSIFICADOR' ||
      actor.profile.role === 'JEFE_PLANTA'

    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const plantId = searchParams.get('plant_id')

    if (!plantId) {
      return NextResponse.json({ error: 'plant_id requerido' }, { status: 400 })
    }

    if (!rhOrGg) {
      if (actor.profile.role === 'DOSIFICADOR') {
        if (!actor.profile.plant_id || actor.profile.plant_id !== plantId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      } else if (actor.profile.role === 'JEFE_PLANTA') {
        const managed = managedPlantIdsForProfile(actor.profile)
        if (!managed.includes(plantId)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    const operators = await buildPlantOperationsRoster(supabase, plantId)

    return NextResponse.json({ operators })
  } catch (error) {
    console.error('[plant-operations-roster]', error)
    return NextResponse.json(
      { error: 'Error al obtener roster de operaciones' },
      { status: 500 }
    )
  }
}
