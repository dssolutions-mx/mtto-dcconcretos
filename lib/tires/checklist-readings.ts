import type { SupabaseClient } from '@supabase/supabase-js'

export interface ChecklistTireReadingInput {
  installation_id: string
  position_code: string
  tread_depth_mm?: number | null
  pressure_psi?: number | null
}

export interface SaveChecklistTireReadingsParams {
  checklist_id: string
  asset_id: string
  recorded_by: string
  readings: ChecklistTireReadingInput[]
  odometer_km?: number | null
  horometer_hours?: number | null
}

export async function saveChecklistTireReadings(
  supabase: SupabaseClient,
  params: SaveChecklistTireReadingsParams
): Promise<{ saved: number; snapshot: ChecklistTireReadingInput[] }> {
  const valid = params.readings.filter(
    (r) =>
      r.installation_id &&
      (r.tread_depth_mm != null || r.pressure_psi != null)
  )

  if (valid.length === 0) {
    return { saved: 0, snapshot: [] }
  }

  const installationIds = [...new Set(valid.map((r) => r.installation_id))]
  const { data: installations } = await supabase
    .from('asset_tire_installations')
    .select('id, tire_id')
    .eq('asset_id', params.asset_id)
    .is('removed_at', null)
    .in('id', installationIds)

  const tireByInst = new Map((installations ?? []).map((i) => [i.id, i.tire_id]))

  const insertRows = valid
    .map((r) => {
      const tire_id = tireByInst.get(r.installation_id)
      if (!tire_id) return null
      return {
        installation_id: r.installation_id,
        tire_id,
        asset_id: params.asset_id,
        checklist_id: params.checklist_id,
        position_code: r.position_code,
        tread_depth_mm: r.tread_depth_mm ?? null,
        pressure_psi: r.pressure_psi ?? null,
        odometer_km: params.odometer_km ?? null,
        horometer_hours: params.horometer_hours ?? null,
        recorded_by: params.recorded_by,
      }
    })
    .filter(Boolean) as Record<string, unknown>[]

  if (insertRows.length === 0) {
    return { saved: 0, snapshot: valid }
  }

  const { error } = await supabase.from('tire_readings').insert(insertRows)
  if (error) {
    console.error('[tire-readings] checklist save', error)
    throw error
  }

  await supabase
    .from('completed_checklists')
    .update({ tire_readings_snapshot: valid })
    .eq('id', params.checklist_id)

  return { saved: insertRows.length, snapshot: valid }
}
