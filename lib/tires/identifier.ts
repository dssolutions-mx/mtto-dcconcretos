import type { SupabaseClient } from '@supabase/supabase-js'
import type { TireIdRules } from '@/types/tires'

const SEQUENCE_PAD = 5
const MAX_UNIQUE_RETRIES = 5

export interface InternalCodeParts {
  prefix: string
  plantCode: string | null
  year: number
  sequence: number
}

export interface PreviewInternalCodeInput {
  rules: TireIdRules
  plantCode?: string | null
  year?: number
  sequence?: number
}

export interface ResolveTireIdentityInput {
  plantId?: string | null
  serialNumber?: string | null
  internalCode?: string | null
}

export interface ResolvedTireIdentity {
  serial_number: string | null
  internal_code: string | null
}

/** Builds the stable prefix segment before the sequence (e.g. DC-LL-P1-2026). */
export function buildInternalCodePrefix(
  rules: TireIdRules,
  plantCode?: string | null,
  year: number = new Date().getFullYear()
): string {
  const base = (rules.internal_prefix?.trim() || 'LL').toUpperCase()
  const segments = [base]
  if (plantCode?.trim()) {
    segments.push(plantCode.trim().toUpperCase())
  }
  segments.push(String(year))
  return segments.join('-')
}

/** Formats a full internal code from parts. */
export function formatInternalCode(parts: InternalCodeParts): string {
  const prefix = buildInternalCodePrefix(
    { internal_prefix: parts.prefix, auto_generate: true },
    parts.plantCode,
    parts.year
  )
  return `${prefix}-${String(parts.sequence).padStart(SEQUENCE_PAD, '0')}`
}

/** Preview next code for UI (does not hit DB). */
export function previewInternalCode({
  rules,
  plantCode,
  year = new Date().getFullYear(),
  sequence = 1,
}: PreviewInternalCodeInput): string {
  if (!rules.auto_generate) {
    if (rules.internal_prefix?.trim()) {
      return `${rules.internal_prefix.trim().toUpperCase()}-12345`
    }
    return 'DOT1234567890'
  }
  return formatInternalCode({
    prefix: rules.internal_prefix?.trim() || 'LL',
    plantCode: plantCode ?? null,
    year,
    sequence,
  })
}

/** Parses trailing sequence from an internal_code with matching prefix. */
export function parseSequenceFromInternalCode(
  internalCode: string,
  prefix: string
): number | null {
  if (!internalCode.startsWith(`${prefix}-`)) return null
  const tail = internalCode.slice(prefix.length + 1)
  if (!/^\d+$/.test(tail)) return null
  const n = Number(tail)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function loadTireIdRules(
  supabase: SupabaseClient,
  plantId?: string | null
): Promise<TireIdRules> {
  if (plantId) {
    const { data: plantSettings } = await supabase
      .from('tire_fleet_settings')
      .select('id_rules')
      .eq('plant_id', plantId)
      .maybeSingle()
    if (plantSettings?.id_rules && typeof plantSettings.id_rules === 'object') {
      return plantSettings.id_rules as TireIdRules
    }
  }

  const { data: globalSettings } = await supabase
    .from('tire_fleet_settings')
    .select('id_rules')
    .is('plant_id', null)
    .maybeSingle()

  return (globalSettings?.id_rules as TireIdRules | undefined) ?? {}
}

async function loadPlantCode(
  supabase: SupabaseClient,
  plantId?: string | null
): Promise<string | null> {
  if (!plantId) return null
  const { data } = await supabase.from('plants').select('code').eq('id', plantId).maybeSingle()
  return data?.code?.trim() || null
}

export async function getNextInternalCode(
  supabase: SupabaseClient,
  rules: TireIdRules,
  plantId?: string | null
): Promise<string> {
  const plantCode = await loadPlantCode(supabase, plantId)
  const year = new Date().getFullYear()
  const prefix = buildInternalCodePrefix(rules, plantCode, year)

  let query = supabase
    .from('tires')
    .select('internal_code')
    .not('internal_code', 'is', null)
    .like('internal_code', `${prefix}-%`)

  if (plantId) {
    query = query.eq('plant_id', plantId)
  }

  const { data, error } = await query.order('internal_code', { ascending: false }).limit(50)

  if (error) {
    throw new Error(`No se pudo calcular el siguiente ID: ${error.message}`)
  }

  let maxSeq = 0
  for (const row of data ?? []) {
    const code = row.internal_code as string
    const seq = parseSequenceFromInternalCode(code, prefix)
    if (seq != null && seq > maxSeq) maxSeq = seq
  }

  return formatInternalCode({
    prefix: rules.internal_prefix?.trim() || 'LL',
    plantCode,
    year,
    sequence: maxSeq + 1,
  })
}

export function validateTireIdentityInput(
  rules: TireIdRules,
  input: ResolveTireIdentityInput
): string | null {
  const serial = input.serialNumber?.trim() || null
  const internal = input.internalCode?.trim() || null

  if (rules.dot_required && !serial) {
    return 'DOT / serial es obligatorio según la configuración de flota'
  }

  if (!rules.auto_generate && !serial && !internal) {
    return 'Indique DOT o ID interno'
  }

  return null
}

/** Resolves serial + internal_code for a new tire row. */
export async function resolveTireIdentityForCreate(
  supabase: SupabaseClient,
  input: ResolveTireIdentityInput
): Promise<ResolvedTireIdentity> {
  const rules = await loadTireIdRules(supabase, input.plantId)
  const validationError = validateTireIdentityInput(rules, input)
  if (validationError) {
    throw new Error(validationError)
  }

  const serial = input.serialNumber?.trim() || null
  let internal_code = input.internalCode?.trim() || null

  if (rules.auto_generate && !internal_code) {
    internal_code = await getNextInternalCode(supabase, rules, input.plantId)
  }

  return {
    serial_number: serial,
    internal_code,
  }
}

/** Insert helper with UNIQUE retry on internal_code collisions. */
export async function insertTireWithIdentity<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  baseRow: T,
  identityInput: ResolveTireIdentityInput
): Promise<{ id: string; internal_code: string | null; serial_number: string | null }> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_UNIQUE_RETRIES; attempt++) {
    const identity = await resolveTireIdentityForCreate(supabase, {
      ...identityInput,
      internalCode: attempt === 0 ? identityInput.internalCode : null,
    })

    const { data, error } = await supabase
      .from('tires')
      .insert({
        ...baseRow,
        serial_number: identity.serial_number,
        internal_code: identity.internal_code,
      })
      .select('id, internal_code, serial_number')
      .single()

    if (!error && data) {
      return {
        id: data.id as string,
        internal_code: (data.internal_code as string | null) ?? null,
        serial_number: (data.serial_number as string | null) ?? null,
      }
    }

    const isUniqueViolation =
      error?.code === '23505' &&
      (error.message.includes('internal_code') || error.message.includes('idx_tires_internal_code'))

    if (isUniqueViolation) {
      lastError = new Error(error.message)
      continue
    }

    throw new Error(error?.message ?? 'No se pudo crear la llanta')
  }

  throw lastError ?? new Error('No se pudo generar un ID interno único')
}
