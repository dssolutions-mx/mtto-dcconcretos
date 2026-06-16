/**
 * Local scheduling times for maintenance planning (plant timezone).
 * Mexico abolished DST in most zones; America/Mexico_City stays UTC-6.
 */

const PLANT_TIMEZONE = "America/Mexico_City"
const PLANT_UTC_OFFSET = "-06:00"

/** Build an ISO-8601 instant from a local calendar date + HH:mm in plant timezone. */
export function plantLocalToIso(dateStr: string, timeHHmm: string): string {
  const [h, m] = timeHHmm.split(":")
  const hh = (h ?? "06").padStart(2, "0")
  const mm = (m ?? "00").padStart(2, "0")
  return `${dateStr}T${hh}:${mm}:00${PLANT_UTC_OFFSET}`
}

/** Add hours to an ISO instant. */
export function addHoursToIso(iso: string, hours: number): string {
  const end = new Date(iso)
  end.setTime(end.getTime() + hours * 3_600_000)
  return end.toISOString()
}

/** Format an ISO instant for display in plant local time. */
export function formatPlantTime(iso: string, pattern: "time" | "datetime" = "time"): string {
  const d = new Date(iso)
  const opts: Intl.DateTimeFormatOptions =
    pattern === "time"
      ? { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: PLANT_TIMEZONE }
      : {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: PLANT_TIMEZONE,
        }
  return new Intl.DateTimeFormat("es-MX", opts).format(d)
}

/** Extract yyyy-MM-dd in plant timezone from an ISO instant. */
export function plantDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PLANT_TIMEZONE }).format(new Date(iso))
}
