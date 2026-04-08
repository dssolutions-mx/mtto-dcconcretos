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
