/**
 * Email routing for diesel cuenta-litros gap notifications.
 * Pattern adapted from cotizador compliance (lib/compliance/recipients.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const ENRIQUE = 'enrique.felix@dcconcretos.com.mx'
const RH = 'rh@dcconcretos.com.mx'
const HECTOR = 'hector.morales@dcconcretos.com.mx'
const ALBERTO_BU = 'jose.torres@dcconcretos.com.mx'
const MARIO_WIDE = 'marioperez@dcconcretos.com.mx'

/** Plant codes in Tijuana region — CC chain differs from Bajío. */
const TIJUANA_PLANT_CODES = new Set(['P002', 'P003', 'P004', 'DIACE'])

const TO_ROLES = ['DOSIFICADOR', 'JEFE_PLANTA', 'ENCARGADO_ALMACEN'] as const

function unique(emails: (string | undefined | null)[]): string[] {
  const s = new Set<string>()
  for (const e of emails) {
    if (e && e.includes('@')) s.add(e.trim().toLowerCase())
  }
  return [...s]
}

export function parseDieselGapCcOverrides(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'))
}

/**
 * Resolves To (plant operational roles) and CC (escalation chain).
 * `plantCode` is optional — when missing, only role-based To + generic CC apply.
 */
export function resolveDieselGapRecipients(
  plantCode: string | null | undefined,
  roleEmails: Partial<Record<(typeof TO_ROLES)[number], string[]>>,
  extraCc: string[] = [],
): { to: string[]; cc: string[] } {
  const to = unique([
    ...(roleEmails.DOSIFICADOR ?? []),
    ...(roleEmails.JEFE_PLANTA ?? []),
    ...(roleEmails.ENCARGADO_ALMACEN ?? []),
  ])

  const cc: string[] = [...extraCc]

  const code = plantCode?.trim().toUpperCase() ?? ''
  if (code && TIJUANA_PLANT_CODES.has(code)) {
    cc.push(ALBERTO_BU, ENRIQUE, RH)
  } else if (code) {
    cc.push(HECTOR, ENRIQUE, RH)
    if (code === 'P004P' || code === 'P005') {
      cc.push(MARIO_WIDE)
    }
  } else {
    cc.push(HECTOR, ENRIQUE, RH)
  }

  const toLower = new Set(to.map((e) => e.toLowerCase()))
  const ccDedup = unique(cc).filter((e) => !toLower.has(e.toLowerCase()))

  return { to, cc: ccDedup }
}

export async function fetchPlantRoleEmails(
  admin: SupabaseClient,
  plantId: string,
): Promise<Partial<Record<(typeof TO_ROLES)[number], string[]>>> {
  const { data, error } = await admin
    .from('profiles')
    .select('email, role')
    .eq('plant_id', plantId)
    .eq('is_active', true)
    .in('role', [...TO_ROLES])

  if (error) {
    console.error('[diesel-gap-email] profiles lookup failed', error)
    return {}
  }

  const out: Partial<Record<(typeof TO_ROLES)[number], string[]>> = {}
  for (const row of (data ?? []) as { email: string | null; role: string }[]) {
    const role = row.role as (typeof TO_ROLES)[number]
    if (!TO_ROLES.includes(role) || !row.email?.includes('@')) continue
    out[role] = [...(out[role] ?? []), row.email.trim().toLowerCase()]
  }
  return out
}
