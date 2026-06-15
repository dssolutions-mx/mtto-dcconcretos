import {
  formatMexicoCityDateOnly,
  mexicoCityMonthWindowFromYm,
  REPORTS_CALENDAR_TIMEZONE,
} from "@/lib/reports/mexico-city-report-window"

export type IncidentDateField = "event" | "registered"

export type IncidentDatePreset =
  | "all"
  | "this_week"
  | "this_month"
  | "last_month"
  | "june_2026_inspection"
  | "custom"

export type DateRangeBounds = {
  fromMs: number
  toMs: number
  fromDate: Date
  toDate: Date
}

export type IncidentLike = {
  date?: string | null
  created_at?: string | null
}

/** Effective timestamp for filtering / age (business date preferred). */
export function incidentEffectiveMs(
  incident: IncidentLike,
  dateField: IncidentDateField = "event",
): number {
  const raw =
    dateField === "registered"
      ? incident.created_at ?? incident.date
      : incident.date ?? incident.created_at
  if (!raw) return NaN
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : NaN
}

export function incidentEffectiveDateOnly(
  incident: IncidentLike,
  dateField: IncidentDateField = "event",
): string | null {
  const ms = incidentEffectiveMs(incident, dateField)
  if (!Number.isFinite(ms)) return null
  return formatMexicoCityDateOnly(ms)
}

function startOfMexicoCityDayUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number)
  return Date.UTC(y, m - 1, d) + 6 * 60 * 60 * 1000
}

function endOfMexicoCityDayUtcMs(ymd: string): number {
  const start = startOfMexicoCityDayUtcMs(ymd)
  return start + 24 * 60 * 60 * 1000 - 1
}

function todayMexicoCityYmd(nowMs: number = Date.now()): string {
  return formatMexicoCityDateOnly(nowMs)
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

/** Monday-start week in Mexico City calendar. */
function thisWeekBoundsMexicoCity(nowMs: number = Date.now()): DateRangeBounds {
  const today = todayMexicoCityYmd(nowMs)
  const [y, m, d] = today.split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = addDaysYmd(today, mondayOffset)
  const sunday = addDaysYmd(monday, 6)
  return {
    fromMs: startOfMexicoCityDayUtcMs(monday),
    toMs: endOfMexicoCityDayUtcMs(sunday),
    fromDate: new Date(startOfMexicoCityDayUtcMs(monday)),
    toDate: new Date(endOfMexicoCityDayUtcMs(sunday)),
  }
}

export function resolveDatePresetBounds(
  preset: IncidentDatePreset,
  customFrom?: Date,
  customTo?: Date,
  nowMs: number = Date.now(),
): DateRangeBounds | null {
  if (preset === "all") return null

  if (preset === "custom") {
    if (!customFrom && !customTo) return null
    const fromYmd = customFrom
      ? formatMexicoCityDateOnly(customFrom.getTime())
      : formatMexicoCityDateOnly((customTo ?? customFrom)!.getTime())
    const toYmd = customTo
      ? formatMexicoCityDateOnly(customTo.getTime())
      : fromYmd
    return {
      fromMs: startOfMexicoCityDayUtcMs(fromYmd),
      toMs: endOfMexicoCityDayUtcMs(toYmd),
      fromDate: new Date(startOfMexicoCityDayUtcMs(fromYmd)),
      toDate: new Date(endOfMexicoCityDayUtcMs(toYmd)),
    }
  }

  if (preset === "this_week") {
    return thisWeekBoundsMexicoCity(nowMs)
  }

  if (preset === "june_2026_inspection") {
    return {
      fromMs: startOfMexicoCityDayUtcMs("2026-06-04"),
      toMs: endOfMexicoCityDayUtcMs("2026-06-11"),
      fromDate: new Date(startOfMexicoCityDayUtcMs("2026-06-04")),
      toDate: new Date(endOfMexicoCityDayUtcMs("2026-06-11")),
    }
  }

  const nowYmd = todayMexicoCityYmd(nowMs)
  const [y, mo] = nowYmd.split("-").map(Number)

  if (preset === "this_month") {
    const w = mexicoCityMonthWindowFromYm(`${y}-${String(mo).padStart(2, "0")}`)
    const lastDay = formatMexicoCityDateOnly(w.endExclusiveMs - 1)
    return {
      fromMs: w.startInclusiveMs,
      toMs: endOfMexicoCityDayUtcMs(lastDay),
      fromDate: new Date(w.startInclusiveMs),
      toDate: new Date(endOfMexicoCityDayUtcMs(lastDay)),
    }
  }

  if (preset === "last_month") {
    const prevMo = mo === 1 ? 12 : mo - 1
    const prevY = mo === 1 ? y - 1 : y
    const w = mexicoCityMonthWindowFromYm(`${prevY}-${String(prevMo).padStart(2, "0")}`)
    const lastDay = formatMexicoCityDateOnly(w.endExclusiveMs - 1)
    return {
      fromMs: w.startInclusiveMs,
      toMs: endOfMexicoCityDayUtcMs(lastDay),
      fromDate: new Date(w.startInclusiveMs),
      toDate: new Date(endOfMexicoCityDayUtcMs(lastDay)),
    }
  }

  return null
}

export function incidentInDateRange(
  incident: IncidentLike,
  bounds: DateRangeBounds,
  dateField: IncidentDateField = "event",
): boolean {
  const ms = incidentEffectiveMs(incident, dateField)
  if (!Number.isFinite(ms)) return false
  return ms >= bounds.fromMs && ms <= bounds.toMs
}

export function formatDateRangeLabel(bounds: DateRangeBounds): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: REPORTS_CALENDAR_TIMEZONE,
  }
  const from = bounds.fromDate.toLocaleDateString("es-MX", opts)
  const to = bounds.toDate.toLocaleDateString("es-MX", opts)
  return `${from} – ${to}`
}

export const DATE_PRESET_LABELS: Record<IncidentDatePreset, string> = {
  all: "Todos",
  this_week: "Esta semana",
  this_month: "Este mes",
  last_month: "Mes pasado",
  june_2026_inspection: "Revisión Jun 2026",
  custom: "Personalizado",
}

export function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined
  const d = new Date(value + "T12:00:00")
  return Number.isNaN(d.getTime()) ? undefined : d
}

export function dateToParam(d: Date | undefined): string {
  if (!d) return ""
  return formatMexicoCityDateOnly(d.getTime())
}
