/**
 * Production availability — cross-check maintenance windows against Cotizador dispatch.
 */

import { createClient } from '@supabase/supabase-js'
import type { AvailabilityCheck, ProductionCommitment } from '@/lib/planning/planning-types'

const DEFAULT_WORK_HOURS = { start: 6, end: 18 }

function getCotizadorClient() {
  const url = process.env.COTIZADOR_SUPABASE_URL
  const key = process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Resolve all unit codes that map to a maintenance asset (asset_id + mappings). */
export async function resolveUnitCodesForAsset(
  supabase: ReturnType<typeof createClient>,
  assetUuid: string,
): Promise<{ asset_code: string | null; unit_codes: string[] }> {
  const { data: asset } = await supabase
    .from('assets')
    .select('asset_id')
    .eq('id', assetUuid)
    .single()

  const codes = new Set<string>()
  if (asset?.asset_id) codes.add(asset.asset_id)

  const { data: mappings } = await supabase
    .from('asset_name_mappings')
    .select('external_unit')
    .eq('asset_id', assetUuid)

  for (const m of mappings ?? []) {
    if (m.external_unit) codes.add(m.external_unit)
  }

  return { asset_code: asset?.asset_id ?? null, unit_codes: [...codes] }
}

export async function fetchProductionCommitments(
  unitCodes: string[],
  fromDate: string,
  toDate: string,
): Promise<ProductionCommitment[]> {
  const cotizador = getCotizadorClient()
  if (!cotizador || unitCodes.length === 0) return []

  const commitments: ProductionCommitment[] = []

  const { data: remisiones } = await cotizador
    .from('remisiones')
    .select('remision_number, fecha, hora_carga, volumen_fabricado, unidad, tipo_remision')
    .in('unidad', unitCodes)
    .gte('fecha', fromDate)
    .lte('fecha', toDate)
    .is('cancelled_reason', null)
    .order('fecha')
    .order('hora_carga')

  for (const r of remisiones ?? []) {
    commitments.push({
      type: 'remision',
      date: r.fecha,
      time: r.hora_carga,
      label: `${r.tipo_remision ?? 'CONCRETO'} #${r.remision_number}`,
      volume_m3: r.volumen_fabricado,
      unit_code: r.unidad ?? '',
    })
  }

  return commitments
}

function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

function commitmentToWindow(c: ProductionCommitment, durationHours = 2): { start: Date; end: Date } {
  const datePart = c.date.slice(0, 10)
  const timePart = c.time?.slice(0, 5) ?? '08:00'
  const start = new Date(`${datePart}T${timePart}:00`)
  const end = new Date(start.getTime() + durationHours * 3_600_000)
  return { start, end }
}

export function findProductionConflicts(
  commitments: ProductionCommitment[],
  windowStart: string,
  windowEnd: string,
): ProductionCommitment[] {
  const wStart = new Date(windowStart)
  const wEnd = new Date(windowEnd)
  return commitments.filter((c) => {
    const { start, end } = commitmentToWindow(c)
    return overlaps(wStart, wEnd, start, end)
  })
}

/** Suggest off-peak slots on a given day (before 6am, after 6pm, or no remisiones). */
export function suggestMaintenanceSlots(
  day: string,
  commitments: ProductionCommitment[],
  durationHours = 4,
): Array<{ starts_at: string; ends_at: string; label: string }> {
  const dayCommitments = commitments.filter((c) => c.date.startsWith(day))
  const slots: Array<{ starts_at: string; ends_at: string; label: string }> = []

  const candidates = [
    { h: 5, label: 'Madrugada (05:00)' },
    { h: 19, label: 'Noche (19:00)' },
  ]

  for (const { h, label } of candidates) {
    const start = new Date(`${day}T${String(h).padStart(2, '0')}:00:00`)
    const end = new Date(start.getTime() + durationHours * 3_600_000)
    const conflicts = dayCommitments.filter((c) => {
      const { start: cs, end: ce } = commitmentToWindow(c)
      return overlaps(start, end, cs, ce)
    })
    if (conflicts.length === 0) {
      slots.push({ starts_at: start.toISOString(), ends_at: end.toISOString(), label })
    }
  }

  if (dayCommitments.length === 0) {
    const start = new Date(`${day}T${String(DEFAULT_WORK_HOURS.start).padStart(2, '0')}:00:00`)
    const end = new Date(start.getTime() + durationHours * 3_600_000)
    slots.unshift({
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      label: 'Día libre — horario diurno',
    })
  }

  return slots
}

export async function checkAssetAvailability(
  supabase: ReturnType<typeof createClient>,
  params: {
    asset_id: string
    starts_at: string
    ends_at: string
    exclude_window_id?: string
  },
): Promise<AvailabilityCheck> {
  const warnings: string[] = []

  const { data: asset } = await supabase
    .from('assets')
    .select('id, asset_id, status')
    .eq('id', params.asset_id)
    .single()

  const { unit_codes } = await resolveUnitCodesForAsset(supabase, params.asset_id)
  const fromDate = params.starts_at.slice(0, 10)
  const toDate = params.ends_at.slice(0, 10)

  const commitments = await fetchProductionCommitments(unit_codes, fromDate, toDate)
  const production_conflicts = findProductionConflicts(commitments, params.starts_at, params.ends_at)

  let overlapping: Array<{ id: string; starts_at: string; ends_at: string; planning_status: string }> = []
  try {
    let overlapQuery = supabase
      .from('asset_service_windows')
      .select('id, starts_at, ends_at, planning_status')
      .eq('asset_id', params.asset_id)
      .in('planning_status', ['draft', 'confirmed', 'in_progress'])
      .lt('starts_at', params.ends_at)
      .gt('ends_at', params.starts_at)

    if (params.exclude_window_id) {
      overlapQuery = overlapQuery.neq('id', params.exclude_window_id)
    }

    const { data } = await overlapQuery
    overlapping = data ?? []
  } catch {
    overlapping = []
  }

  if (asset?.status === 'repair') {
    warnings.push('Unidad en reparación — verificar con operaciones antes de programar.')
  }

  if (production_conflicts.length > 0) {
    warnings.push(
      `${production_conflicts.length} compromiso(s) de producción en el horario propuesto.`,
    )
  }

  if (overlapping.length > 0) {
    warnings.push('Ya existe otra ventana de servicio en ese horario.')
  }

  const suggested_slots = suggestMaintenanceSlots(fromDate, commitments)

  return {
    asset_id: params.asset_id,
    asset_code: asset?.asset_id ?? null,
    asset_status: asset?.status ?? null,
    window_start: params.starts_at,
    window_end: params.ends_at,
    production_conflicts,
    overlapping_windows: overlapping,
    suggested_slots,
    can_schedule: overlapping.length === 0,
    warnings,
  }
}
