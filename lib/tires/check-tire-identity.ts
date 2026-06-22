import type { SupabaseClient } from '@supabase/supabase-js'
import { formatTirePrimaryId } from '@/lib/tires/display'
import { normalizeDotSerial, normalizeInternalCode } from '@/lib/tires/normalize-identity'
import type { Tire, TireStatus } from '@/types/tires'

type TireIdentityRow = Pick<Tire, 'id' | 'internal_code' | 'serial_number' | 'brand' | 'size' | 'status'>

export type IdentityCheckState = 'available' | 'duplicate' | 'not_found'

export interface ExistingTireMatch {
  id: string
  label: string
  status: TireStatus
  href: string
}

export interface IdentityFieldResult {
  state: IdentityCheckState
  message?: string
  existing?: ExistingTireMatch
}

export interface TireIdentityCheckResult {
  dot: IdentityFieldResult | null
  internal_code: IdentityFieldResult | null
}

const STATUS_LABELS: Record<TireStatus, string> = {
  en_almacen: 'En almacén',
  montada: 'Montada',
  baja: 'Baja',
}

function toExistingMatch(row: TireIdentityRow): ExistingTireMatch {
  return {
    id: row.id,
    label: formatTirePrimaryId(row),
    status: row.status,
    href: `/activos/llantas/${row.id}`,
  }
}

async function findTireByDot(
  supabase: SupabaseClient,
  dot: string
): Promise<TireIdentityRow | null> {
  const normalized = normalizeDotSerial(dot)
  if (!normalized) return null

  const { data: exactMatch } = await supabase
    .from('tires')
    .select('id, internal_code, serial_number, brand, size, status')
    .eq('serial_number', normalized)
    .maybeSingle()

  if (exactMatch) return exactMatch as TireIdentityRow

  const { data: candidates } = await supabase
    .from('tires')
    .select('id, internal_code, serial_number, brand, size, status')
    .not('serial_number', 'is', null)
    .ilike('serial_number', normalized)
    .limit(10)

  return (
    (candidates as TireIdentityRow[] | null)?.find(
      (row) => normalizeDotSerial(row.serial_number ?? '') === normalized
    ) ?? null
  )
}

async function findTireByInternalCode(
  supabase: SupabaseClient,
  internalCode: string
): Promise<TireIdentityRow | null> {
  const normalized = normalizeInternalCode(internalCode)
  if (!normalized) return null

  const { data: exactMatch } = await supabase
    .from('tires')
    .select('id, internal_code, serial_number, brand, size, status')
    .eq('internal_code', normalized)
    .maybeSingle()

  if (exactMatch) return exactMatch as TireIdentityRow

  const { data: candidates } = await supabase
    .from('tires')
    .select('id, internal_code, serial_number, brand, size, status')
    .not('internal_code', 'is', null)
    .ilike('internal_code', normalized)
    .limit(10)

  return (
    (candidates as TireIdentityRow[] | null)?.find(
      (row) => normalizeInternalCode(row.internal_code ?? '') === normalized
    ) ?? null
  )
}

export async function checkTireIdentity(
  supabase: SupabaseClient,
  input: { dot?: string | null; internal_code?: string | null }
): Promise<TireIdentityCheckResult> {
  const result: TireIdentityCheckResult = {
    dot: null,
    internal_code: null,
  }

  const dot = input.dot?.trim()
  if (dot) {
    const existing = await findTireByDot(supabase, dot)
    if (existing) {
      result.dot = {
        state: 'duplicate',
        message: `Ya registrado como ${toExistingMatch(existing).label} (${STATUS_LABELS[existing.status]})`,
        existing: toExistingMatch(existing),
      }
    } else {
      result.dot = {
        state: 'available',
        message: 'DOT disponible',
      }
    }
  }

  const internalCode = input.internal_code?.trim()
  if (internalCode) {
    const existing = await findTireByInternalCode(supabase, internalCode)
    if (existing) {
      result.internal_code = {
        state: 'duplicate',
        message: `Código de flota ya usado por ${toExistingMatch(existing).label}`,
        existing: toExistingMatch(existing),
      }
    } else {
      result.internal_code = {
        state: 'available',
        message: 'Código de flota disponible',
      }
    }
  }

  return result
}
