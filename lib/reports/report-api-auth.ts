import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { effectiveRoleForPermissions } from '@/lib/auth/role-model'
import { loadActorContext, type ActorContext } from '@/lib/auth/server-authorization'
import { hasModuleAccess } from '@/lib/auth/role-permissions'
import { canAccessManualCostsReport, canAccessReportsModule } from '@/lib/reports/reports-catalog'

export type ReportsApiAuthResult =
  | { ok: true; actor: ActorContext; supabase: Awaited<ReturnType<typeof createServerSupabase>> }
  | { ok: false; response: NextResponse }

export async function requireReportsApiAccess(): Promise<ReportsApiAuthResult> {
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

  if (!canAccessReportsModule(actor.profile)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sin permiso para módulo de reportes' },
        { status: 403 }
      ),
    }
  }

  return { ok: true, actor, supabase }
}

export async function requireManualCostsApiAccess(): Promise<ReportsApiAuthResult> {
  const base = await requireReportsApiAccess()
  if (!base.ok) return base
  if (!canAccessManualCostsReport(base.actor.profile)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sin permiso para costos manuales' },
        { status: 403 }
      ),
    }
  }
  return base
}

/** Recompute eficiencia diésel — maintenance leadership + gerencia. */
export function canRecomputeDieselEfficiency(actor: ActorContext): boolean {
  const key = effectiveRoleForPermissions(actor.profile)
  if (!key) return false
  if (!hasModuleAccess(key, 'reports')) return false
  const role = actor.profile.role
  return (
    role === 'GERENCIA_GENERAL' ||
    role === 'GERENTE_MANTENIMIENTO' ||
    role === 'AREA_ADMINISTRATIVA' ||
    role === 'JEFE_UNIDAD_NEGOCIO'
  )
}
