import { createClient } from '@/lib/supabase-server'
import { loadActorContext } from '@/lib/auth/server-authorization'
import {
  assertCanEditScheduleDraft,
  loadScheduleForDraftAuth,
} from '@/lib/checklist/schedule-draft-auth'
import {
  clearedScheduleDraftRowUpdate,
  isChecklistScheduleDraftPayload,
  type ChecklistScheduleDraftPayload,
} from '@/lib/checklist/schedule-draft'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

async function resolveSupabase(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        cookies: { getAll: () => [], setAll: () => {} },
      }
    )
  }
  return createClient()
}

async function authorizeDraftAccess(
  supabase: Awaited<ReturnType<typeof resolveSupabase>>,
  scheduleId: string
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    }
  }

  const actor = await loadActorContext(supabase, user.id)
  if (!actor) {
    return {
      error: NextResponse.json(
        { error: 'Perfil no encontrado o inactivo' },
        { status: 403 }
      ),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'active') {
    return {
      error: NextResponse.json(
        { error: 'Perfil no encontrado o inactivo' },
        { status: 403 }
      ),
    }
  }

  const { schedule, error: scheduleError } = await loadScheduleForDraftAuth(
    supabase,
    scheduleId
  )
  if (scheduleError || !schedule) {
    return {
      error: NextResponse.json(
        { error: 'Checklist programado no encontrado' },
        { status: 404 }
      ),
    }
  }

  const auth = await assertCanEditScheduleDraft(supabase, actor, schedule)
  if (!auth.allowed) {
    return {
      error: NextResponse.json(
        {
          error: 'No tiene permisos para editar el borrador de este checklist',
          details: auth.reason,
        },
        { status: 403 }
      ),
    }
  }

  return { user, schedule }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await resolveSupabase(request)
    const authResult = await authorizeDraftAccess(supabase, id)
    if ('error' in authResult && authResult.error) {
      return authResult.error
    }

    const { schedule } = authResult as {
      schedule: NonNullable<
        Awaited<ReturnType<typeof loadScheduleForDraftAuth>>['schedule']
      >
    }

    return NextResponse.json({
      draft_payload: schedule.draft_payload ?? null,
      draft_updated_at: schedule.draft_updated_at ?? null,
      draft_updated_by: schedule.draft_updated_by ?? null,
    })
  } catch (e) {
    console.error('[checklist-draft] GET', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await resolveSupabase(request)
    const authResult = await authorizeDraftAccess(supabase, id)
    if ('error' in authResult && authResult.error) {
      return authResult.error
    }

    const { user, schedule } = authResult as {
      user: { id: string }
      schedule: NonNullable<
        Awaited<ReturnType<typeof loadScheduleForDraftAuth>>['schedule']
      >
    }

    const body = await request.json()
    const incomingPayload = body?.draft_payload
    const clientUpdatedAt: string | null | undefined = body?.draft_updated_at

    if (!isChecklistScheduleDraftPayload(incomingPayload)) {
      return NextResponse.json(
        { error: 'draft_payload inválido' },
        { status: 400 }
      )
    }

    const serverUpdatedAt = schedule.draft_updated_at
    if (
      clientUpdatedAt &&
      serverUpdatedAt &&
      new Date(serverUpdatedAt).getTime() > new Date(clientUpdatedAt).getTime()
    ) {
      return NextResponse.json(
        {
          error: 'Conflicto de borrador: existe una versión más reciente en el servidor',
          draft_payload: schedule.draft_payload ?? null,
          draft_updated_at: serverUpdatedAt,
        },
        { status: 409 }
      )
    }

    const mergedPayload: ChecklistScheduleDraftPayload = {
      ...(isChecklistScheduleDraftPayload(schedule.draft_payload)
        ? schedule.draft_payload
        : {}),
      ...incomingPayload,
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('checklist_schedules')
      .update({
        draft_payload: mergedPayload,
        draft_updated_at: now,
        draft_updated_by: user.id,
      })
      .eq('id', id)
      .select('draft_payload, draft_updated_at, draft_updated_by')
      .single()

    if (updateError) {
      console.error('[checklist-draft] PATCH', updateError)
      return NextResponse.json(
        { error: 'No se pudo guardar el borrador' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      draft_payload: updated.draft_payload,
      draft_updated_at: updated.draft_updated_at,
      draft_updated_by: updated.draft_updated_by,
    })
  } catch (e) {
    console.error('[checklist-draft] PATCH', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await resolveSupabase(request)
    const authResult = await authorizeDraftAccess(supabase, id)
    if ('error' in authResult && authResult.error) {
      return authResult.error
    }

    const { error: updateError } = await supabase
      .from('checklist_schedules')
      .update(clearedScheduleDraftRowUpdate())
      .eq('id', id)

    if (updateError) {
      console.error('[checklist-draft] DELETE', updateError)
      return NextResponse.json(
        { error: 'No se pudo descartar el borrador' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      draft_payload: null,
      draft_updated_at: null,
      draft_updated_by: null,
    })
  } catch (e) {
    console.error('[checklist-draft] DELETE', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

