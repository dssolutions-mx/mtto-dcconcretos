/**
 * Operating hours for gerencial / executive views: merges diesel horometer progression
 * with checklist equipment hour readings (same approach as asset-maintenance-summary).
 * Trusted hours for reporting use merged-first policy (`resolveTrustedOperatingHours`): when the
 * merged/capped curve yields positive hours, that value wins; otherwise sum of `hours_consumed`.
 *
 * `asset_meter_reading_events` is raw (no jump filter in SQL). Parity vs merged output uses
 * `buildMergedHoursReadingEventsForAsset` fed either table rows or view rows (same diesel + checklist IDs).
 *
 * Extended-window diesel horometer points are loaded from `asset_meter_reading_events` (diesel branch matches
 * warehouse + product diesel filters in SQL) instead of querying `diesel_transactions` directly.
 *
 * The view is a normal SQL view (no materialization): each read reflects current `diesel_transactions` /
 * `completed_checklists` / audit rows. Liters and money still come from `diesel_transactions` because those
 * columns are not exposed on the view. Gerencial uses `fetchDieselPeriodConsumptionTxsForReportAssets` for
 * the same diesel row scope as the summary API, scoped to report assets.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveTrustedOperatingHours } from '@/lib/reports/diesel-efficiency-hours-policy'
import { formatMexicoCityDateOnly } from '@/lib/reports/mexico-city-report-window'

const METER_VIEW_ASSET_CHUNK = 100

/** Diesel consumption rows with horometer, same membership as the view diesel branch (warehouse + product diesel). */
export type DieselHorometerRowForMerge = {
  asset_id: string
  transaction_date: string
  horometer_reading?: number | null
}

/** Liters/cost fields from `diesel_transactions` (consumption rows, diesel warehouse + diesel product). */
export type DieselConsumptionCostRow = {
  asset_id: string | null
  quantity_liters: number | null
  transaction_type: string | null
  unit_cost: number | null
  product_id: string | null
}

/**
 * Chunked read of diesel horometer progression from `asset_meter_reading_events`.
 * `eventAtGte` / `eventAtLt` should be full ISO-8601 instants so `timestamptz` filters do not
 * depend on the database session time zone (YYYY-MM-DD-only strings are ambiguous).
 */
export async function fetchDieselHorometerFromMeterView(
  supabase: SupabaseClient,
  params: {
    assetIds: string[]
    eventAtGte: string
    eventAtLt: string
  }
): Promise<DieselHorometerRowForMerge[]> {
  const { assetIds, eventAtGte, eventAtLt } = params
  const out: DieselHorometerRowForMerge[] = []
  for (let i = 0; i < assetIds.length; i += METER_VIEW_ASSET_CHUNK) {
    const chunk = assetIds.slice(i, i + METER_VIEW_ASSET_CHUNK)
    const { data } = await supabase
      .from('asset_meter_reading_events')
      .select('asset_id, event_at, hours_reading')
      .in('asset_id', chunk)
      .eq('source_kind', 'diesel_consumption')
      .not('hours_reading', 'is', null)
      .gte('event_at', eventAtGte)
      .lt('event_at', eventAtLt)

    for (const row of data || []) {
      const aid = row.asset_id
      if (!aid) continue
      out.push({
        asset_id: aid,
        transaction_date: String(row.event_at),
        horometer_reading: row.hours_reading != null ? Number(row.hours_reading) : null,
      })
    }
  }
  return out
}

/**
 * Subset of meter-view horometer rows whose `event_at` falls in [periodStartMs, periodEndExclusiveMs).
 * Keeps one extended view fetch and splits in memory so validation (extended) and in-period diesel curve stay aligned.
 */
export function meterHorometerRowsInReportWindow(
  rows: DieselHorometerRowForMerge[],
  periodStartMs: number,
  periodEndExclusiveMs: number
): DieselHorometerRowForMerge[] {
  return rows.filter((r) => {
    const t = new Date(r.transaction_date).getTime()
    return !Number.isNaN(t) && t >= periodStartMs && t < periodEndExclusiveMs
  })
}

/** Consumption transactions for liters/cost; same diesel membership as `asset_meter_reading_events` diesel branch. */
export async function fetchDieselConsumptionCostRowsForAssets(
  supabase: SupabaseClient,
  params: {
    assetIds: string[]
    transactionDateGte: string
    transactionDateLt: string
  }
): Promise<DieselConsumptionCostRow[]> {
  const { assetIds, transactionDateGte, transactionDateLt } = params
  const out: DieselConsumptionCostRow[] = []
  for (let i = 0; i < assetIds.length; i += METER_VIEW_ASSET_CHUNK) {
    const chunk = assetIds.slice(i, i + METER_VIEW_ASSET_CHUNK)
    const { data } = await supabase
      .from('diesel_transactions')
      .select(
        `
        asset_id,
        quantity_liters,
        transaction_type,
        unit_cost,
        product_id,
        diesel_warehouses!inner(product_type),
        diesel_products!inner(product_type)
      `
      )
      .in('asset_id', chunk)
      .eq('diesel_warehouses.product_type', 'diesel')
      .eq('diesel_products.product_type', 'diesel')
      .neq('is_transfer', true)
      .eq('transaction_type', 'consumption')
      .gte('transaction_date', transactionDateGte)
      .lt('transaction_date', transactionDateLt)

    for (const row of data || []) {
      out.push({
        asset_id: row.asset_id,
        quantity_liters: row.quantity_liters != null ? Number(row.quantity_liters) : null,
        transaction_type: row.transaction_type,
        unit_cost: row.unit_cost != null ? Number(row.unit_cost) : null,
        product_id: row.product_id,
      })
    }
  }
  return out
}

/**
 * Consumption transactions in the report window for gerencial: FIFO, liters, generated hours/km, and
 * `computeMergedOperatingHoursByAsset` diagnostics. Chunked by `asset_id`; same diesel membership as the
 * meter view diesel branch (diesel warehouse + diesel product, non-transfer consumption).
 * Prefer full ISO bounds from `mexicoCityMonthWindowFromYm` when bucketing by business month (timestamptz-safe).
 */
export type DieselPeriodConsumptionTxRow = {
  id: string
  asset_id: string | null
  quantity_liters: number | null
  transaction_type: string | null
  unit_cost: number | null
  product_id: string | null
  transaction_date: string
  horometer_reading: number | null
  previous_horometer: number | null
  kilometer_reading: number | null
  previous_kilometer: number | null
  hours_consumed: number | null
  kilometers_consumed: number | null
  is_transfer: boolean | null
}

export async function fetchDieselPeriodConsumptionTxsForReportAssets(
  supabase: SupabaseClient,
  params: {
    assetIds: string[]
    transactionDateGte: string
    transactionDateLt: string
  }
): Promise<DieselPeriodConsumptionTxRow[]> {
  const { assetIds, transactionDateGte, transactionDateLt } = params
  if (assetIds.length === 0) return []
  const out: DieselPeriodConsumptionTxRow[] = []
  for (let i = 0; i < assetIds.length; i += METER_VIEW_ASSET_CHUNK) {
    const chunk = assetIds.slice(i, i + METER_VIEW_ASSET_CHUNK)
    const { data } = await supabase
      .from('diesel_transactions')
      .select(
        `
        id,
        asset_id,
        quantity_liters,
        transaction_type,
        unit_cost,
        product_id,
        transaction_date,
        horometer_reading,
        previous_horometer,
        kilometer_reading,
        previous_kilometer,
        hours_consumed,
        kilometers_consumed,
        is_transfer,
        diesel_warehouses!inner(product_type),
        diesel_products!inner(product_type)
      `
      )
      .in('asset_id', chunk)
      .eq('diesel_warehouses.product_type', 'diesel')
      .eq('diesel_products.product_type', 'diesel')
      .neq('is_transfer', true)
      .eq('transaction_type', 'consumption')
      .gte('transaction_date', transactionDateGte)
      .lt('transaction_date', transactionDateLt)

    for (const row of data || []) {
      if (!row.id) continue
      out.push({
        id: row.id,
        asset_id: row.asset_id,
        quantity_liters: row.quantity_liters != null ? Number(row.quantity_liters) : null,
        transaction_type: row.transaction_type,
        unit_cost: row.unit_cost != null ? Number(row.unit_cost) : null,
        product_id: row.product_id,
        transaction_date: String(row.transaction_date),
        horometer_reading: numericOrNull(row.horometer_reading),
        previous_horometer: numericOrNull(row.previous_horometer),
        kilometer_reading: numericOrNull(row.kilometer_reading),
        previous_kilometer: numericOrNull(row.previous_kilometer),
        hours_consumed: numericOrNull(row.hours_consumed),
        kilometers_consumed: numericOrNull(row.kilometers_consumed),
        is_transfer: row.is_transfer ?? null,
      })
    }
  }
  return out
}

export type MergedHoursReadingEvent = { ts: number; val: number }

type ReadingEvent = MergedHoursReadingEvent

const MAX_HOURS_PER_DAY = 24

function numericOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

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

/** Operational time for checklist meter row; aligns with `asset_meter_reading_events` checklist branch (UTC noon on completion calendar day when no reading_timestamp). */
export function checklistReadingEventTimeMs(row: {
  reading_timestamp: string | null
  completion_date: string
}): number {
  if (row.reading_timestamp) return new Date(row.reading_timestamp).getTime()
  const raw = row.completion_date
  const datePart = raw.includes('T') ? raw.split('T')[0]! : raw.slice(0, 10)
  return new Date(`${datePart}T12:00:00.000Z`).getTime()
}

/** Diesel + band-filtered checklist hour readings before `mergedHoursFromEvents` (same rules as gerencial). */
export function buildMergedHoursReadingEventsForAsset(params: {
  dieselTxs: Array<{ transaction_date: string; horometer_reading?: number | null }>
  checklistReadingEvents: ReadingEvent[]
}): ReadingEvent[] {
  const { dieselTxs, checklistReadingEvents: chkEvents } = params
  const events: ReadingEvent[] = []
  const dieselReadings = dieselReadingsFromTxs(dieselTxs)
  events.push(...dieselReadings)

  const validationValues = buildDieselValidationValues(dieselTxs)
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

/** Proration + in-month stats for UI (diesel efficiency drill); same math as `mergedHoursFromEvents`. */
export type MergedHoursWindowDetails = {
  hours: number
  readingsInMonth: number
  startVal: number | null
  endVal: number | null
  startTs: number | null
  endTs: number | null
  startIsProrated: boolean
  endIsProrated: boolean
  lastBefore: ReadingEvent | null
  firstAfter: ReadingEvent | null
}

/**
 * Hours from merged horometer + checklist readings inside [startMs, endMs) (end exclusive),
 * plus interpolation endpoints for breakdown UIs. Does not mutate `events`.
 */
export function mergedHoursWindowDetails(
  events: ReadingEvent[],
  startMs: number,
  endMs: number
): MergedHoursWindowDetails {
  const empty = (): MergedHoursWindowDetails => ({
    hours: 0,
    readingsInMonth: 0,
    startVal: null,
    endVal: null,
    startTs: null,
    endTs: null,
    startIsProrated: false,
    endIsProrated: false,
    lastBefore: null,
    firstAfter: null,
  })
  if (events.length === 0) return empty()

  const sorted = [...events].sort((a, b) => a.ts - b.ts)
  const unique: ReadingEvent[] = []
  for (const e of sorted) {
    const prev = unique[unique.length - 1]
    if (!prev || prev.ts !== e.ts || prev.val !== e.val) unique.push(e)
  }

  const inMonth = unique.filter((e) => e.ts >= startMs && e.ts < endMs)
  if (inMonth.length === 0) return empty()

  const firstInMonth = inMonth[0]!
  const lastInMonth = inMonth[inMonth.length - 1]!

  const lastBefore = unique.slice().reverse().find((e) => e.ts < startMs) ?? null
  let startVal: number
  let startTs: number
  let startIsProrated = false
  if (lastBefore && firstInMonth.ts > startMs && firstInMonth.val > lastBefore.val) {
    const frac = (startMs - lastBefore.ts) / (firstInMonth.ts - lastBefore.ts)
    startVal = lastBefore.val + frac * (firstInMonth.val - lastBefore.val)
    startTs = startMs
    startIsProrated = true
  } else {
    startVal = firstInMonth.val
    startTs = firstInMonth.ts
  }

  const firstAfter = unique.find((e) => e.ts >= endMs) ?? null
  let endVal: number
  let endTs: number
  let endIsProrated = false
  if (firstAfter && lastInMonth.ts < endMs && firstAfter.val > lastInMonth.val) {
    const frac = (endMs - lastInMonth.ts) / (firstAfter.ts - lastInMonth.ts)
    endVal = lastInMonth.val + frac * (firstAfter.val - lastInMonth.val)
    endTs = endMs
    endIsProrated = true
  } else {
    endVal = lastInMonth.val
    endTs = lastInMonth.ts
  }

  const delta = endVal - startVal
  const hours = delta > 0 ? delta : 0
  return {
    hours,
    readingsInMonth: inMonth.length,
    startVal,
    endVal,
    startTs,
    endTs,
    startIsProrated,
    endIsProrated,
    lastBefore,
    firstAfter,
  }
}

/**
 * Hours from merged horometer + checklist readings inside [startMs, endMs) (end exclusive).
 *
 * Uses the range between first and last readings of the month, with linear interpolation
 * at both boundaries when there are bracketing events outside the window. This prorates
 * the cross-month gap so partial-day usage at month edges is allocated correctly.
 */
export function mergedHoursFromEvents(
  events: ReadingEvent[],
  startMs: number,
  endMs: number
): number {
  return mergedHoursWindowDetails(events, startMs, endMs).hours
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
  /** Assets where trusted hours (merged-first policy) > 0 */
  assets_with_positive_hours: number
  /** Assets where merged horometer/checklist produced > 0 */
  assets_with_merged_track: number
  /** Assets where merged and sum(raw hours_consumed) disagree materially */
  assets_with_merge_fork: number
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
): Promise<{
  hoursByAsset: Map<string, number>
  hoursMergedByAsset: Map<string, number>
  hoursSumByAsset: Map<string, number>
  mergeForkByAsset: Map<string, boolean>
  diagnostics: MergedHoursDiagnostics
}> {
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
  const hoursMergedByAsset = new Map<string, number>()
  const hoursSumByAsset = new Map<string, number>()
  const mergeForkByAsset = new Map<string, boolean>()
  if (assetIds.length === 0) {
    return {
      hoursByAsset,
      hoursMergedByAsset,
      hoursSumByAsset,
      mergeForkByAsset,
      diagnostics: {
        diesel_consumption_tx_in_period,
        diesel_tx_with_hours_consumed,
        diesel_hours_consumed_sum,
        diesel_horometer_rows_extended: 0,
        checklist_rows_extended: 0,
        assets_with_positive_hours: 0,
        assets_with_merged_track: 0,
        assets_with_merge_fork: 0,
      },
    }
  }

  const extendedStartMs = dateFromStart.getTime() - 30 * 24 * 60 * 60 * 1000
  const extendedStartDateStr = formatMexicoCityDateOnly(extendedStartMs)
  const eventAtGteIso = new Date(extendedStartMs).toISOString()
  const eventAtLtIso = dateToExclusive.toISOString()

  const { data: hoursData } = await supabase
    .from('completed_checklists')
    .select('asset_id, equipment_hours_reading, reading_timestamp, completion_date')
    .in('asset_id', assetIds)
    .gte('completion_date', extendedStartDateStr)
    .lt('completion_date', dateToExclusiveStr)
    .not('equipment_hours_reading', 'is', null)

  const dieselTxsExtended = await fetchDieselHorometerFromMeterView(supabase, {
    assetIds,
    eventAtGte: eventAtGteIso,
    eventAtLt: eventAtLtIso,
  })

  const dieselByAsset = new Map<string, Array<{ transaction_date: string; horometer_reading?: number | null }>>()
  for (const t of dieselTxsExtended) {
    const aid = t.asset_id
    if (!aid) continue
    if (!dieselByAsset.has(aid)) dieselByAsset.set(aid, [])
    dieselByAsset.get(aid)!.push(t)
  }

  const checklistEventsByAsset = new Map<string, ReadingEvent[]>()
  for (const h of hoursData || []) {
    if (!h.asset_id) continue
    const val = Number(h.equipment_hours_reading)
    const ts = checklistReadingEventTimeMs({
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
  let assets_with_merge_fork = 0

  for (const assetId of allAssetIdsWithReadings) {
    const txs = dieselByAsset.get(assetId) || []
    const chkEvents = checklistEventsByAsset.get(assetId) || []
    const events = buildMergedHoursReadingEventsForAsset({
      dieselTxs: txs,
      checklistReadingEvents: chkEvents,
    })

    const merged = mergedHoursFromEvents(events, startMs, endMs)
    const consumed = dieselConsumedHoursByAsset.get(assetId) || 0
    const { trusted, mergeFork } = resolveTrustedOperatingHours(merged, consumed)
    hoursMergedByAsset.set(assetId, merged)
    hoursSumByAsset.set(assetId, consumed)
    mergeForkByAsset.set(assetId, mergeFork)
    if (mergeFork) assets_with_merge_fork++
    if (merged > 0) assets_with_merged_track++
    if (trusted > 0) hoursByAsset.set(assetId, trusted)
  }

  for (const aid of assetIds) {
    if (hoursByAsset.has(aid)) continue
    const consumed = dieselConsumedHoursByAsset.get(aid) || 0
    if (consumed > 0) {
      hoursByAsset.set(aid, consumed)
      hoursMergedByAsset.set(aid, 0)
      hoursSumByAsset.set(aid, consumed)
      mergeForkByAsset.set(aid, false)
    }
  }

  let assets_with_positive_hours = 0
  hoursByAsset.forEach((h) => {
    if (h > 0) assets_with_positive_hours++
  })

  return {
    hoursByAsset,
    hoursMergedByAsset,
    hoursSumByAsset,
    mergeForkByAsset,
    diagnostics: {
      diesel_consumption_tx_in_period,
      diesel_tx_with_hours_consumed,
      diesel_hours_consumed_sum,
      diesel_horometer_rows_extended: dieselTxsExtended.length,
      checklist_rows_extended: hoursData?.length ?? 0,
      assets_with_positive_hours,
      assets_with_merged_track,
      assets_with_merge_fork,
    },
  }
}
