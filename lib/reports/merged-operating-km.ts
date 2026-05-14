/**
 * Trusted kilometers for diesel L/km: merges diesel odómetro points from `asset_meter_reading_events`
 * with checklist `equipment_kilometers_reading`, then applies merged-first policy
 * (`resolveTrustedOperatingKilometers`) — parallel to merged operating hours.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveTrustedOperatingKilometers } from '@/lib/reports/diesel-efficiency-hours-policy'
import {
  checklistReadingEventTimeMs,
  mergedHoursFromEvents,
  type MergedHoursReadingEvent,
} from '@/lib/reports/merged-operating-hours'
import { formatMexicoCityDateOnly } from '@/lib/reports/mexico-city-report-window'

const METER_VIEW_ASSET_CHUNK = 100

/** ~33 km/h if spread over 24h; rejects impossible odometer jumps between diesel readings (tune with ops). */
const MAX_KM_PER_DAY = 800

export type DieselKilometerRowForMerge = {
  asset_id: string
  transaction_date: string
  kilometer_reading?: number | null
}

export async function fetchDieselKilometerFromMeterView(
  supabase: SupabaseClient,
  params: {
    assetIds: string[]
    eventAtGte: string
    eventAtLt: string
  }
): Promise<DieselKilometerRowForMerge[]> {
  const { assetIds, eventAtGte, eventAtLt } = params
  const out: DieselKilometerRowForMerge[] = []
  for (let i = 0; i < assetIds.length; i += METER_VIEW_ASSET_CHUNK) {
    const chunk = assetIds.slice(i, i + METER_VIEW_ASSET_CHUNK)
    const { data } = await supabase
      .from('asset_meter_reading_events')
      .select('asset_id, event_at, km_reading')
      .in('asset_id', chunk)
      .eq('source_kind', 'diesel_consumption')
      .not('km_reading', 'is', null)
      .gte('event_at', eventAtGte)
      .lt('event_at', eventAtLt)

    for (const row of data || []) {
      const aid = row.asset_id
      if (!aid) continue
      out.push({
        asset_id: aid,
        transaction_date: String(row.event_at),
        kilometer_reading: row.km_reading != null ? Number(row.km_reading) : null,
      })
    }
  }
  return out
}

type ReadingEvent = MergedHoursReadingEvent

function dieselKmReadingsFromTxs(
  txs: Array<{ transaction_date: string; kilometer_reading?: number | null }>
): ReadingEvent[] {
  const raw: Array<{ ts: number; val: number }> = []
  for (const t of txs) {
    const tts = new Date(t.transaction_date).getTime()
    if (Number.isNaN(tts) || t.kilometer_reading == null) continue
    const v = Number(t.kilometer_reading)
    if (Number.isNaN(v)) continue
    raw.push({ ts: tts, val: v })
  }
  if (raw.length === 0) return []
  raw.sort((a, b) => a.ts - b.ts)
  const out: ReadingEvent[] = []
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i]!
    if (i === 0) {
      out.push({ ts: cur.ts, val: cur.val })
      continue
    }
    const prev = raw[i - 1]!
    const days = (cur.ts - prev.ts) / (1000 * 60 * 60 * 24)
    const delta = cur.val - prev.val
    const kpd = days > 0 ? delta / days : 0
    if (delta >= 0 && (days >= 60 || kpd <= MAX_KM_PER_DAY)) {
      out.push({ ts: cur.ts, val: cur.val })
    }
  }
  return out
}

function buildDieselKmValidationValues(
  txs: Array<{ transaction_date: string; kilometer_reading?: number | null }>
): number[] {
  const raw: Array<{ val: number; date: string }> = []
  for (const t of txs) {
    if (t.kilometer_reading == null) continue
    const val = Number(t.kilometer_reading)
    if (Number.isNaN(val)) continue
    raw.push({ val, date: t.transaction_date })
  }
  if (raw.length === 0) return []
  raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const valid: number[] = []
  for (let i = 0; i < raw.length; i++) {
    const current = raw[i]!
    if (i === 0) {
      valid.push(current.val)
      continue
    }
    const previous = raw[i - 1]!
    const timeDeltaDays =
      (new Date(current.date).getTime() - new Date(previous.date).getTime()) / (1000 * 60 * 60 * 24)
    const delta = current.val - previous.val
    const kmPerDay = timeDeltaDays > 0 ? delta / timeDeltaDays : 0
    if (delta >= 0 && (timeDeltaDays >= 60 || kmPerDay <= MAX_KM_PER_DAY)) {
      valid.push(current.val)
    }
  }
  return valid
}

export function buildMergedKmReadingEventsForAsset(params: {
  dieselTxs: Array<{ transaction_date: string; kilometer_reading?: number | null }>
  checklistReadingEvents: ReadingEvent[]
}): ReadingEvent[] {
  const { dieselTxs, checklistReadingEvents: chkEvents } = params
  const events: ReadingEvent[] = []
  const dieselReadings = dieselKmReadingsFromTxs(dieselTxs)
  events.push(...dieselReadings)

  const validationValues = buildDieselKmValidationValues(dieselTxs)
  if (validationValues.length > 0 || dieselReadings.length > 0) {
    const vals = validationValues.length > 0 ? validationValues : dieselReadings.map((e) => e.val)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const rng = max - min
    const allowedMin = min - rng * 2
    const allowedMax = max + rng * 2
    chkEvents.forEach((e) => {
      if (e.val >= allowedMin && e.val <= allowedMax) events.push(e)
    })
  } else {
    events.push(...chkEvents)
  }
  return events
}

/** Km delta inside the window from merged odómetro + checklist events (same proration as hours). */
export function mergedKmFromEvents(events: ReadingEvent[], startMs: number, endMs: number): number {
  return mergedHoursFromEvents(events, startMs, endMs)
}

export type MergedKmDiagnostics = {
  diesel_consumption_tx_in_period: number
  diesel_tx_with_km_consumed: number
  diesel_km_consumed_sum: number
  diesel_kilometer_rows_extended: number
  checklist_km_rows_extended: number
  assets_with_positive_km: number
  assets_with_merged_km_track: number
  assets_with_merge_fork_km: number
}

export async function computeMergedOperatingKmByAsset(
  supabase: SupabaseClient,
  params: {
    assetIds: string[]
    dateFromStart: Date
    dateToExclusive: Date
    dateToExclusiveStr: string
    dieselConsumedKmByAsset: Map<string, number>
    periodDieselConsumptionTxs: Array<{
      asset_id: string | null
      kilometers_consumed?: number | null
      transaction_type?: string | null
    }>
  }
): Promise<{
  kmByAsset: Map<string, number>
  kmMergedByAsset: Map<string, number>
  kmSumByAsset: Map<string, number>
  mergeForkKmByAsset: Map<string, boolean>
  diagnostics: MergedKmDiagnostics
}> {
  const { assetIds, dateFromStart, dateToExclusive, dateToExclusiveStr, dieselConsumedKmByAsset, periodDieselConsumptionTxs } =
    params

  let diesel_consumption_tx_in_period = 0
  let diesel_tx_with_km_consumed = 0
  let diesel_km_consumed_sum = 0
  for (const t of periodDieselConsumptionTxs) {
    if (t.transaction_type !== 'consumption' || !t.asset_id) continue
    diesel_consumption_tx_in_period++
    const k = Number(t.kilometers_consumed || 0)
    if (k > 0) diesel_tx_with_km_consumed++
    diesel_km_consumed_sum += k
  }

  const kmByAsset = new Map<string, number>()
  const kmMergedByAsset = new Map<string, number>()
  const kmSumByAsset = new Map<string, number>()
  const mergeForkKmByAsset = new Map<string, boolean>()

  if (assetIds.length === 0) {
    return {
      kmByAsset,
      kmMergedByAsset,
      kmSumByAsset,
      mergeForkKmByAsset,
      diagnostics: {
        diesel_consumption_tx_in_period,
        diesel_tx_with_km_consumed,
        diesel_km_consumed_sum,
        diesel_kilometer_rows_extended: 0,
        checklist_km_rows_extended: 0,
        assets_with_positive_km: 0,
        assets_with_merged_km_track: 0,
        assets_with_merge_fork_km: 0,
      },
    }
  }

  const extendedStartMs = dateFromStart.getTime() - 30 * 24 * 60 * 60 * 1000
  const extendedStartDateStr = formatMexicoCityDateOnly(extendedStartMs)
  const eventAtGteIso = new Date(extendedStartMs).toISOString()
  const eventAtLtIso = dateToExclusive.toISOString()

  const { data: kmChecklistData } = await supabase
    .from('completed_checklists')
    .select('asset_id, equipment_kilometers_reading, reading_timestamp, completion_date')
    .in('asset_id', assetIds)
    .gte('completion_date', extendedStartDateStr)
    .lt('completion_date', dateToExclusiveStr)
    .not('equipment_kilometers_reading', 'is', null)

  const dieselKmExtended = await fetchDieselKilometerFromMeterView(supabase, {
    assetIds,
    eventAtGte: eventAtGteIso,
    eventAtLt: eventAtLtIso,
  })

  const dieselByAsset = new Map<string, Array<{ transaction_date: string; kilometer_reading?: number | null }>>()
  for (const t of dieselKmExtended) {
    const aid = t.asset_id
    if (!aid) continue
    if (!dieselByAsset.has(aid)) dieselByAsset.set(aid, [])
    dieselByAsset.get(aid)!.push(t)
  }

  const checklistKmEventsByAsset = new Map<string, ReadingEvent[]>()
  for (const h of kmChecklistData || []) {
    if (!h.asset_id) continue
    const val = Number(h.equipment_kilometers_reading)
    const ts = checklistReadingEventTimeMs({
      reading_timestamp: h.reading_timestamp,
      completion_date: h.completion_date,
    })
    if (Number.isNaN(val) || Number.isNaN(ts)) continue
    if (!checklistKmEventsByAsset.has(h.asset_id)) checklistKmEventsByAsset.set(h.asset_id, [])
    checklistKmEventsByAsset.get(h.asset_id)!.push({ ts, val })
  }

  const allAssetIdsWithReadings = new Set<string>()
  checklistKmEventsByAsset.forEach((_, aid) => allAssetIdsWithReadings.add(aid))
  dieselByAsset.forEach((_, aid) => allAssetIdsWithReadings.add(aid))

  const startMs = dateFromStart.getTime()
  const endMs = dateToExclusive.getTime()

  let assets_with_merged_km_track = 0
  let assets_with_merge_fork_km = 0

  for (const assetId of allAssetIdsWithReadings) {
    const txs = dieselByAsset.get(assetId) || []
    const chkEvents = checklistKmEventsByAsset.get(assetId) || []
    const events = buildMergedKmReadingEventsForAsset({
      dieselTxs: txs,
      checklistReadingEvents: chkEvents,
    })

    const merged = mergedKmFromEvents(events, startMs, endMs)
    const consumed = dieselConsumedKmByAsset.get(assetId) || 0
    const { trusted, mergeFork } = resolveTrustedOperatingKilometers(merged, consumed)
    kmMergedByAsset.set(assetId, merged)
    kmSumByAsset.set(assetId, consumed)
    mergeForkKmByAsset.set(assetId, mergeFork)
    if (mergeFork) assets_with_merge_fork_km++
    if (merged > 0) assets_with_merged_km_track++
    if (trusted > 0) kmByAsset.set(assetId, trusted)
  }

  for (const aid of assetIds) {
    if (kmByAsset.has(aid)) continue
    const consumed = dieselConsumedKmByAsset.get(aid) || 0
    if (consumed > 0) {
      kmByAsset.set(aid, consumed)
      kmMergedByAsset.set(aid, 0)
      kmSumByAsset.set(aid, consumed)
      mergeForkKmByAsset.set(aid, false)
    }
  }

  let assets_with_positive_km = 0
  kmByAsset.forEach((k) => {
    if (k > 0) assets_with_positive_km++
  })

  return {
    kmByAsset,
    kmMergedByAsset,
    kmSumByAsset,
    mergeForkKmByAsset,
    diagnostics: {
      diesel_consumption_tx_in_period,
      diesel_tx_with_km_consumed,
      diesel_km_consumed_sum,
      diesel_kilometer_rows_extended: dieselKmExtended.length,
      checklist_km_rows_extended: kmChecklistData?.length ?? 0,
      assets_with_positive_km,
      assets_with_merged_km_track,
      assets_with_merge_fork_km,
    },
  }
}
