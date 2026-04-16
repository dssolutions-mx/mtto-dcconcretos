/**
 * Operating hours for gerencial / executive views: merges diesel horometer progression
 * with checklist equipment hour readings (same approach as asset-maintenance-summary).
 * Falls back to summing diesel transaction `hours_consumed` when horometer deltas are unavailable.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

type ReadingEvent = { ts: number; val: number }

const MAX_HOURS_PER_DAY = 24

function dieselReadingsFromTxs(
  txs: Array<{ transaction_date: string; horometer_reading?: number | null }>
): ReadingEvent[] {
  const raw: Array<{ ts: number; val: number }> = []
  for (const t of txs) {
    const tts = new Date(t.transaction_date).getTime()
    if (Number.isNaN(tts) || t.horometer_reading == null) continue
    const v = Number(t.horometer_reading)
    if (Number.isNaN(v)) continue
    raw.push({ ts: tts, val: v })
  }
  if (raw.length === 0) return []
  raw.sort((a, b) => a.ts - b.ts)
  const out: ReadingEvent[] = []
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i]
    if (i === 0) {
      out.push({ ts: cur.ts, val: cur.val })
      continue
    }
    const prev = raw[i - 1]
    const days = (cur.ts - prev.ts) / (1000 * 60 * 60 * 24)
    const delta = cur.val - prev.val
    const hpd = days > 0 ? delta / days : 0
    if (delta >= 0 && (days >= 60 || hpd <= MAX_HOURS_PER_DAY)) {
      out.push({ ts: cur.ts, val: cur.val })
    }
  }
  return out
}

function buildDieselValidationValues(
  txs: Array<{ transaction_date: string; horometer_reading?: number | null }>
): number[] {
  const raw: Array<{ val: number; date: string }> = []
  for (const t of txs) {
    if (!t.horometer_reading) continue
    const val = Number(t.horometer_reading)
    if (Number.isNaN(val)) continue
    raw.push({ val, date: t.transaction_date })
  }
  if (raw.length === 0) return []
  raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const valid: number[] = []
  for (let i = 0; i < raw.length; i++) {
    const current = raw[i]
    if (i === 0) {
      valid.push(current.val)
      continue
    }
    const previous = raw[i - 1]
    const timeDeltaDays =
      (new Date(current.date).getTime() - new Date(previous.date).getTime()) / (1000 * 60 * 60 * 24)
    const delta = current.val - previous.val
    const hoursPerDay = timeDeltaDays > 0 ? delta / timeDeltaDays : 0
    if (delta >= 0 && (timeDeltaDays >= 60 || hoursPerDay <= MAX_HOURS_PER_DAY)) {
      valid.push(current.val)
    }
  }
  return valid
}

function checklistTs(row: { reading_timestamp: string | null; completion_date: string }): number {
  if (row.reading_timestamp) return new Date(row.reading_timestamp).getTime()
  return new Date(`${row.completion_date}T12:00:00.000Z`).getTime()
}

/**
 * Hours from merged horometer + checklist deltas inside [startMs, endMs) (end exclusive).
 */
export function mergedHoursFromEvents(
  events: ReadingEvent[],
  startMs: number,
  endMs: number
): number {
  if (events.length < 2) return 0
  events.sort((a, b) => a.ts - b.ts)
  const uniqueEvents: ReadingEvent[] = []
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    const prev = uniqueEvents[uniqueEvents.length - 1]
    if (!prev || prev.ts !== e.ts || prev.val !== e.val) uniqueEvents.push(e)
  }
  if (uniqueEvents.length < 2) return 0

  let baselineIdx = -1
  for (let i = uniqueEvents.length - 1; i >= 0; i--) {
    if (uniqueEvents[i].ts < startMs) {
      baselineIdx = i
      break
    }
  }
  if (baselineIdx === -1) {
    for (let i = 0; i < uniqueEvents.length; i++) {
      if (uniqueEvents[i].ts >= startMs) {
        baselineIdx = i
        break
      }
    }
  }
  if (baselineIdx === -1 || baselineIdx >= uniqueEvents.length - 1) return 0

  let totalHours = 0
  for (let i = baselineIdx; i < uniqueEvents.length - 1; i++) {
    const current = uniqueEvents[i]
    const next = uniqueEvents[i + 1]
    if (next.ts < startMs) continue
    if (current.ts >= endMs) break
    const delta = next.val - current.val
    if (delta < 0) continue
    const timeDeltaDays = (next.ts - current.ts) / (1000 * 60 * 60 * 24)
    if (timeDeltaDays < 1 / 24) continue
    const hoursPerDay = timeDeltaDays > 0 ? delta / timeDeltaDays : 0
    if (hoursPerDay > MAX_HOURS_PER_DAY && timeDeltaDays < 60) continue
    let cappedDelta = delta
    if (timeDeltaDays > 0) {
      const maxReasonableDelta = MAX_HOURS_PER_DAY * timeDeltaDays
      if (delta > maxReasonableDelta) cappedDelta = maxReasonableDelta
    }
    totalHours += cappedDelta
  }
  return totalHours
}

export type MergedHoursDiagnostics = {
  /** Diesel consumption rows in report period with asset_id */
  diesel_consumption_tx_in_period: number
  /** Those rows with hours_consumed > 0 */
  diesel_tx_with_hours_consumed: number
  /** Sum of hours_consumed on consumption rows in period */
  diesel_hours_consumed_sum: number
  /** Extended-window diesel rows used for horometer (consumption, horometer set) */
  diesel_horometer_rows_extended: number
  /** Checklist rows in extended window with equipment reading */
  checklist_rows_extended: number
  /** Assets where max(merged, consumed) > 0 */
  assets_with_positive_hours: number
  /** Assets where merged horometer/checklist produced > 0 */
  assets_with_merged_track: number
}

export async function computeMergedOperatingHoursByAsset(
  supabase: SupabaseClient,
  params: {
    assetIds: string[]
    dateFromStart: Date
    dateToExclusive: Date
    dateToExclusiveStr: string
    /** Per-asset sum of hours_consumed from period consumption transactions */
    dieselConsumedHoursByAsset: Map<string, number>
    /** Raw diesel txs in period (for diagnostics) */
    periodDieselConsumptionTxs: Array<{
      asset_id: string | null
      hours_consumed?: number | null
      transaction_type?: string | null
    }>
  }
): Promise<{ hoursByAsset: Map<string, number>; diagnostics: MergedHoursDiagnostics }> {
  const {
    assetIds,
    dateFromStart,
    dateToExclusive,
    dateToExclusiveStr,
    dieselConsumedHoursByAsset,
    periodDieselConsumptionTxs,
  } = params

  let diesel_consumption_tx_in_period = 0
  let diesel_tx_with_hours_consumed = 0
  let diesel_hours_consumed_sum = 0
  for (const t of periodDieselConsumptionTxs) {
    if (t.transaction_type !== 'consumption' || !t.asset_id) continue
    diesel_consumption_tx_in_period++
    const h = Number(t.hours_consumed || 0)
    if (h > 0) diesel_tx_with_hours_consumed++
    diesel_hours_consumed_sum += h
  }

  const hoursByAsset = new Map<string, number>()
  if (assetIds.length === 0) {
    return {
      hoursByAsset,
      diagnostics: {
        diesel_consumption_tx_in_period,
        diesel_tx_with_hours_consumed,
        diesel_hours_consumed_sum,
        diesel_horometer_rows_extended: 0,
        checklist_rows_extended: 0,
        assets_with_positive_hours: 0,
        assets_with_merged_track: 0,
      },
    }
  }

  const extendedStart = new Date(dateFromStart)
  extendedStart.setUTCDate(extendedStart.getUTCDate() - 30)
  const extendedStartDateStr = extendedStart.toISOString().slice(0, 10)

  const { data: hoursData } = await supabase
    .from('completed_checklists')
    .select('asset_id, equipment_hours_reading, reading_timestamp, completion_date')
    .in('asset_id', assetIds)
    .gte('completion_date', extendedStartDateStr)
    .lt('completion_date', dateToExclusiveStr)
    .not('equipment_hours_reading', 'is', null)

  const { data: dieselTxsExtended } = await supabase
    .from('diesel_transactions')
    .select(
      `
        asset_id,
        transaction_date,
        transaction_type,
        horometer_reading,
        diesel_warehouses!inner(product_type)
      `
    )
    .eq('diesel_warehouses.product_type', 'diesel')
    .neq('is_transfer', true)
    .eq('transaction_type', 'consumption')
    .gte('transaction_date', extendedStartDateStr)
    .lt('transaction_date', dateToExclusiveStr)
    .in('asset_id', assetIds)
    .not('horometer_reading', 'is', null)

  const dieselByAsset = new Map<string, Array<{ transaction_date: string; horometer_reading?: number | null }>>()
  for (const t of dieselTxsExtended || []) {
    const aid = t.asset_id
    if (!aid) continue
    if (!dieselByAsset.has(aid)) dieselByAsset.set(aid, [])
    dieselByAsset.get(aid)!.push(t)
  }

  const dieselValidationByAsset = new Map<string, number[]>()
  dieselByAsset.forEach((txs, aid) => {
    const v = buildDieselValidationValues(txs)
    if (v.length > 0) dieselValidationByAsset.set(aid, v)
  })

  const checklistEventsByAsset = new Map<string, ReadingEvent[]>()
  for (const h of hoursData || []) {
    if (!h.asset_id) continue
    const val = Number(h.equipment_hours_reading)
    const ts = checklistTs({
      reading_timestamp: h.reading_timestamp,
      completion_date: h.completion_date,
    })
    if (Number.isNaN(val) || Number.isNaN(ts)) continue
    if (!checklistEventsByAsset.has(h.asset_id)) checklistEventsByAsset.set(h.asset_id, [])
    checklistEventsByAsset.get(h.asset_id)!.push({ ts, val })
  }

  const allAssetIdsWithReadings = new Set<string>()
  checklistEventsByAsset.forEach((_, aid) => allAssetIdsWithReadings.add(aid))
  dieselByAsset.forEach((_, aid) => allAssetIdsWithReadings.add(aid))

  const startMs = dateFromStart.getTime()
  const endMs = dateToExclusive.getTime()

  let assets_with_merged_track = 0

  for (const assetId of allAssetIdsWithReadings) {
    const events: ReadingEvent[] = []
    const txs = dieselByAsset.get(assetId) || []
    const dieselReadings = dieselReadingsFromTxs(txs)
    events.push(...dieselReadings)

    const chkEvents = checklistEventsByAsset.get(assetId) || []
    const validationValues = dieselValidationByAsset.get(assetId) || []
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

    const merged = mergedHoursFromEvents(events, startMs, endMs)
    const consumed = dieselConsumedHoursByAsset.get(assetId) || 0
    const finalH = Math.max(merged, consumed)
    if (merged > 0) assets_with_merged_track++
    if (finalH > 0) hoursByAsset.set(assetId, finalH)
  }

  for (const aid of assetIds) {
    if (hoursByAsset.has(aid)) continue
    const consumed = dieselConsumedHoursByAsset.get(aid) || 0
    if (consumed > 0) hoursByAsset.set(aid, consumed)
  }

  let assets_with_positive_hours = 0
  hoursByAsset.forEach((h) => {
    if (h > 0) assets_with_positive_hours++
  })

  return {
    hoursByAsset,
    diagnostics: {
      diesel_consumption_tx_in_period,
      diesel_tx_with_hours_consumed,
      diesel_hours_consumed_sum,
      diesel_horometer_rows_extended: dieselTxsExtended?.length ?? 0,
      checklist_rows_extended: hoursData?.length ?? 0,
      assets_with_positive_hours,
      assets_with_merged_track,
    },
  }
}
