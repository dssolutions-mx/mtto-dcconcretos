/**
 * Fetch `asset_meter_reading_events` rows that correspond exactly to the same
 * diesel_transactions + completed_checklists rows used by merged-hours (extended window).
 * Excludes `asset_field_audit` — merged pipeline does not use manual asset edits.
 *
 * Diesel id filter uses warehouse + product inner joins so the rowset matches the view
 * (`asset_meter_reading_events` diesel branch). `computeMergedOperatingHoursByAsset` loads
 * extended-window diesel horometer points from that view via `fetchDieselHorometerFromMeterView`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type MeterViewRowForHours = {
  source_kind: string
  source_id: string
  event_at: string
  hours_reading: number | null
  km_reading: number | null
  km_consumed: number | null
}

export async function fetchMeterViewRowsMatchingMergedTableWindows(
  supabase: SupabaseClient,
  assetId: string,
  extendedStartDateStr: string,
  dateToExclusiveStr: string
): Promise<MeterViewRowForHours[]> {
  const { data: dieselMeta, error: dErr } = await supabase
    .from('diesel_transactions')
    .select(
      `
        id,
        diesel_warehouses!inner(product_type),
        diesel_products!inner(product_type)
      `
    )
    .eq('asset_id', assetId)
    .eq('transaction_type', 'consumption')
    .eq('is_transfer', false)
    .eq('diesel_warehouses.product_type', 'diesel')
    .eq('diesel_products.product_type', 'diesel')
    .gte('transaction_date', extendedStartDateStr)
    .lt('transaction_date', dateToExclusiveStr)
    .not('horometer_reading', 'is', null)

  if (dErr) throw dErr

  const { data: chkMeta, error: cErr } = await supabase
    .from('completed_checklists')
    .select('id')
    .eq('asset_id', assetId)
    .gte('completion_date', extendedStartDateStr)
    .lt('completion_date', dateToExclusiveStr)
    .not('equipment_hours_reading', 'is', null)

  if (cErr) throw cErr

  const dieselIds = (dieselMeta ?? []).map((r: { id: string }) => r.id)
  const chkIds = (chkMeta ?? []).map((r: { id: string }) => r.id)

  const chunks: MeterViewRowForHours[] = []
  const chunkSize = 120

  for (let i = 0; i < dieselIds.length; i += chunkSize) {
    const slice = dieselIds.slice(i, i + chunkSize)
    if (slice.length === 0) continue
    const { data, error } = await supabase
      .from('asset_meter_reading_events')
      .select('source_kind, source_id, event_at, hours_reading, km_reading, km_consumed')
      .eq('asset_id', assetId)
      .eq('source_kind', 'diesel_consumption')
      .in('source_id', slice)
    if (error) throw error
    chunks.push(...((data ?? []) as MeterViewRowForHours[]))
  }

  for (let i = 0; i < chkIds.length; i += chunkSize) {
    const slice = chkIds.slice(i, i + chunkSize)
    if (slice.length === 0) continue
    const { data, error } = await supabase
      .from('asset_meter_reading_events')
      .select('source_kind, source_id, event_at, hours_reading, km_reading, km_consumed')
      .eq('asset_id', assetId)
      .eq('source_kind', 'checklist_completion')
      .in('source_id', slice)
    if (error) throw error
    chunks.push(...((data ?? []) as MeterViewRowForHours[]))
  }

  return chunks
}

/** Map meter view rows to diesel_tx-shaped rows + checklist ReadingEvents for `buildMergedHoursReadingEventsForAsset`. */
export function splitMeterViewRowsForMergedHours(rows: MeterViewRowForHours[]): {
  dieselTxs: Array<{ transaction_date: string; horometer_reading: number | null }>
  checklistReadingEvents: Array<{ ts: number; val: number }>
} {
  const dieselTxs: Array<{ transaction_date: string; horometer_reading: number | null }> = []
  const checklistReadingEvents: Array<{ ts: number; val: number }> = []

  for (const r of rows) {
    if (r.hours_reading == null) continue
    const val = Number(r.hours_reading)
    if (Number.isNaN(val)) continue

    if (r.source_kind === 'diesel_consumption') {
      dieselTxs.push({
        transaction_date: r.event_at,
        horometer_reading: val,
      })
    } else if (r.source_kind === 'checklist_completion') {
      const ts = new Date(r.event_at).getTime()
      if (!Number.isNaN(ts)) checklistReadingEvents.push({ ts, val })
    }
  }

  return { dieselTxs, checklistReadingEvents }
}
