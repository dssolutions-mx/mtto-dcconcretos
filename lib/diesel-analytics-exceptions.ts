export type DieselExceptionFlag = {
  transaction_id: string
  transaction_date: string
  warehouse_id: string
  asset_id: string | null
  exception_asset_name: string | null
  quantity_liters: number
  codes: string[]
  reasons: string[]
}

const IMPLAUSIBLE_L_PER_HOUR = 200
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000

function localHourMexico(iso: string): number {
  const d = new Date(iso)
  return parseInt(
    d.toLocaleString("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Mexico_City",
    }),
    10
  )
}

function isWeekendMexico(iso: string): boolean {
  const d = new Date(iso)
  const day = d.toLocaleString("en-US", { weekday: "short", timeZone: "America/Mexico_City" })
  return day === "Sat" || day === "Sun"
}

export function buildDieselExceptionFlags(
  rows: Array<{
    id: string
    transaction_date: string
    warehouse_id: string
    asset_id: string | null
    exception_asset_name: string | null
    quantity_liters: number
    horometer_reading: number | null
    kilometer_reading: number | null
    hours_consumed: number | null
    kilometers_consumed: number | null
  }>
): DieselExceptionFlag[] {
  const sorted = [...rows].sort(
    (a, b) =>
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  )

  const lastReadingByAsset = new Map<
    string,
    { h: number | null; k: number | null; at: number }
  >()

  const out: DieselExceptionFlag[] = []

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]
    const codes: string[] = []
    const reasons: string[] = []

    const key =
      r.asset_id ??
      (r.exception_asset_name ? `ext:${r.exception_asset_name}` : `wh:${r.warehouse_id}`)

    const h = localHourMexico(r.transaction_date)
    if (h < 6 || h >= 22 || isWeekendMexico(r.transaction_date)) {
      codes.push("after_hours")
      reasons.push("Movimiento en horario no habitual o fin de semana (zona Ciudad de México).")
    }

    if (r.asset_id && (r.horometer_reading != null || r.kilometer_reading != null)) {
      const prevState = lastReadingByAsset.get(key)
      const t = new Date(r.transaction_date).getTime()
      if (prevState) {
        if (
          r.horometer_reading != null &&
          prevState.h != null &&
          r.horometer_reading < prevState.h
        ) {
          codes.push("reading_rollback")
          reasons.push(
            `Horómetro retrocedió respecto al consumo anterior (${prevState.h} → ${r.horometer_reading}).`
          )
        }
        if (
          r.kilometer_reading != null &&
          prevState.k != null &&
          r.kilometer_reading < prevState.k
        ) {
          codes.push("reading_rollback_km")
          reasons.push(
            `Kilometraje retrocedió respecto al consumo anterior (${prevState.k} → ${r.kilometer_reading}).`
          )
        }
      }
      lastReadingByAsset.set(key, {
        h: r.horometer_reading ?? prevState?.h ?? null,
        k: r.kilometer_reading ?? prevState?.k ?? null,
        at: t,
      })
    }

    if (
      r.hours_consumed != null &&
      r.hours_consumed > 0 &&
      r.quantity_liters / r.hours_consumed > IMPLAUSIBLE_L_PER_HOUR
    ) {
      codes.push("implausible_rate")
      reasons.push(
        `Consumo implausible: ${(r.quantity_liters / r.hours_consumed).toFixed(1)} L/h (umbral ${IMPLAUSIBLE_L_PER_HOUR}).`
      )
    }

    if (r.asset_id && !r.horometer_reading && !r.kilometer_reading) {
      codes.push("missing_reading")
      reasons.push("Equipo formal sin lectura de horómetro ni kilometraje en este consumo.")
    }

    for (let j = i - 1; j >= 0; j--) {
      const o = sorted[j]
      const sameAsset =
        r.asset_id &&
        o.asset_id &&
        r.asset_id === o.asset_id &&
        r.warehouse_id === o.warehouse_id
      const sameExternal =
        !r.asset_id &&
        !o.asset_id &&
        r.exception_asset_name &&
        r.exception_asset_name === o.exception_asset_name &&
        r.warehouse_id === o.warehouse_id
      if (!sameAsset && !sameExternal) continue

      const dt =
        new Date(r.transaction_date).getTime() -
        new Date(o.transaction_date).getTime()
      if (dt >= 0 && dt <= DUPLICATE_WINDOW_MS) {
        codes.push("duplicate_burst")
        reasons.push("Dos consumos del mismo activo en menos de 15 minutos.")
        break
      }
      if (dt > DUPLICATE_WINDOW_MS) break
    }

    if (codes.length > 0) {
      out.push({
        transaction_id: r.id,
        transaction_date: r.transaction_date,
        warehouse_id: r.warehouse_id,
        asset_id: r.asset_id,
        exception_asset_name: r.exception_asset_name,
        quantity_liters: Number(r.quantity_liters),
        codes: [...new Set(codes)],
        reasons: [...new Set(reasons)],
      })
    }
  }

  return out.sort(
    (a, b) =>
      new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
  )
}
