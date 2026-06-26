/**
 * Local calendar date/time helpers for diesel forms.
 * Avoid `toISOString().split('T')[0]` — it uses UTC and shifts the calendar day
 * for users in Mexico after ~6pm local vs UTC.
 */

export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function getLocalTimeString(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0")
  const min = String(date.getMinutes()).padStart(2, "0")
  return `${h}:${min}`
}

export function parseLocalDateTimeFields(
  date: string,
  time: string
): {
  year: number
  month: number
  day: number
  hours: number
  minutes: number
} | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time.trim())
  if (!dateMatch || !timeMatch) return null

  return {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hours: Number(timeMatch[1]),
    minutes: Number(timeMatch[2]),
  }
}

/**
 * Convert form date/time (device local wall clock) to UTC ISO for diesel_transactions.
 * Uses the Date(y, m, d, h, min) constructor — same approach as transaction-edit-modal.
 */
export function localDateTimeToUtcIso(date: string, time: string): string {
  const parts = parseLocalDateTimeFields(date, time)
  if (!parts) {
    throw new Error(`Invalid local date/time: ${date} ${time}`)
  }

  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hours,
    parts.minutes,
    0,
    0
  ).toISOString()
}

/** UTC ISO from DB → local form fields for date/time inputs. */
export function utcIsoToLocalDateTimeFields(iso: string): {
  date: string
  time: string
} | null {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return null
  return {
    date: getLocalDateString(dt),
    time: getLocalTimeString(dt),
  }
}

/**
 * Format an ISO timestamp from the DB for accounting export (dd/mm/yyyy in local calendar).
 */
export function formatLocalDateForAccounting(dateStr: string): string {
  if (!dateStr) return "-"
  try {
    const dt = new Date(dateStr)
    if (Number.isNaN(dt.getTime())) return "-"
    const dd = String(dt.getDate()).padStart(2, "0")
    const mm = String(dt.getMonth() + 1).padStart(2, "0")
    const yyyy = String(dt.getFullYear())
    return `${dd}/${mm}/${yyyy}`
  } catch {
    return "-"
  }
}
