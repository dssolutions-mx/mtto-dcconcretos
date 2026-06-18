import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { loadActorContext, type ActorContext } from '@/lib/auth/server-authorization'
import { canManageIncidentSlaTargets } from '@/lib/incidents/incident-sla-targets'

export type IncidentSlaAdminAuthResult =
  | { ok: true; actor: ActorContext; supabase: Awaited<ReturnType<typeof createServerSupabase>> }
  | { ok: false; response: NextResponse }

export async function requireIncidentSlaAdminAccess(): Promise<IncidentSlaAdminAuthResult> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }

  const actor = await loadActorContext(supabase, user.id)
  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 }),
    }
  }

  if (!canManageIncidentSlaTargets(actor.profile)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            'Sin permiso para administrar objetivos SLA. Se requiere liderazgo de mantenimiento o acceso de configuración.',
        },
        { status: 403 },
      ),
    }
  }

  return { ok: true, actor, supabase }
}
