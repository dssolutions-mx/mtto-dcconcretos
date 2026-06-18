import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { loadActorContext } from '@/lib/auth/server-authorization'
import { getDieselPlantScope } from '@/lib/diesel-analytics-scope'

const GAP_EMAIL_SEND_ROLES = new Set([
  'GERENCIA_GENERAL',
  'GERENTE_MANTENIMIENTO',
  'JEFE_UNIDAD_NEGOCIO',
  'JEFE_PLANTA',
  'COORDINADOR_MANTENIMIENTO',
  'ENCARGADO_MANTENIMIENTO',
  'AREA_ADMINISTRATIVA',
])

export type DieselGapEmailAuthResult =
  | {
      ok: true
      userId: string
      supabase: Awaited<ReturnType<typeof createServerSupabase>>
    }
  | { ok: false; response: NextResponse }

export async function assertDieselGapEmailSender(): Promise<DieselGapEmailAuthResult> {
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

  const actor = await loadActorContext(
    supabase as unknown as Parameters<typeof loadActorContext>[0],
    user.id,
  )
  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 }),
    }
  }

  if (!GAP_EMAIL_SEND_ROLES.has(actor.profile.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sin permiso para enviar correos de huecos cuenta litros' },
        { status: 403 },
      ),
    }
  }

  return { ok: true, userId: user.id, supabase }
}

export async function assertWarehouseInScope(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  plantId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const scope = await getDieselPlantScope(
    supabase as unknown as Parameters<typeof getDieselPlantScope>[0],
  )
  if (scope.plantIds !== null && !scope.plantIds.includes(plantId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sin acceso a este almacén' }, { status: 403 }),
    }
  }
  return { ok: true }
}

function dedupeEmails(arr: string[]): string[] {
  return Array.from(new Set(arr.map((e) => e.toLowerCase().trim()))).filter((e) =>
    e.includes('@'),
  )
}

export function finalizeRecipients(
  to: string[] | undefined,
  cc: string[] | undefined,
  draft: { to: string[]; cc: string[] },
): { to: string[]; cc: string[] } {
  const finalTo = to ? dedupeEmails(to) : draft.to
  const finalCc = cc ? dedupeEmails(cc) : draft.cc
  const toSet = new Set(finalTo)
  const ccClean = finalCc.filter((e) => !toSet.has(e))
  return { to: finalTo, cc: ccClean }
}

export function prependExecutiveNote(html: string, note?: string): string {
  if (!note?.trim()) return html
  const escaped = note.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<blockquote style="border-left:4px solid #f59e0b;margin:0 0 16px 0;padding:8px 16px;background:#fffbeb;color:#92400e;font-style:italic">${escaped}</blockquote>\n${html}`
}
