export type CuentaLitrosGapAnchor = {
  tx_id: string
  transaction_id: string
  transaction_date: string
  quantity_liters: number
  cuenta_litros: number
  asset_label: string | null
}

export type CuentaLitrosGapIntervalTx = {
  id: string
  transaction_id: string
  transaction_type: string
  transaction_date: string
  quantity_liters: number
  cuenta_litros: number | null
  asset_label: string | null
  is_transfer?: boolean
  notes: string | null
}

export type CuentaLitrosGap = {
  id: string
  warehouse_id: string
  prev_anchor: CuentaLitrosGapAnchor
  curr_anchor: CuentaLitrosGapAnchor
  time_window_ms: number
  time_window_label: string
  prev_cuenta_litros: number
  curr_cuenta_litros: number
  meter_delta: number
  registered_liters: number
  gap_liters: number
  gap_type: "unregistered_dispense" | "over_registered" | "within_tolerance"
  narrative: string
  short_label: string
  transaction_ids_in_interval: string[]
  transactions_in_interval: CuentaLitrosGapIntervalTx[]
}

export type GapTransactionInput = {
  id: string
  transaction_id: string
  transaction_type: string
  quantity_liters: number
  transaction_date: string
  created_at?: string
  cuenta_litros: number | null
  is_transfer?: boolean
  notes: string | null
  asset_name?: string | null
  asset_id?: string | null
  exception_asset_name?: string | null
}

export type BuildCuentaLitrosGapsOptions = {
  warehouse_id: string
  has_cuenta_litros: boolean
  tolerance_liters?: number
  /** Local calendar date (YYYY-MM-DD, GMT-6) — only txs on/after this date are considered */
  audit_from?: string
}

export const CUENTA_LITROS_GAP_AUDIT_FROM = "2026-04-01"

import { CUENTA_LITROS_VARIANCE_TOLERANCE_LITERS } from "@/lib/diesel/cuenta-litros-variance"

/** UTC timestamp → local YYYY-MM-DD (GMT-6), matching warehouse page toLocalYmd */
function toLocalYmd(utcTimestamp: string): string {
  if (!utcTimestamp) return ""
  const utcDate = new Date(utcTimestamp)
  const localTimeMs = utcDate.getTime() - 6 * 60 * 60 * 1000
  const localDate = new Date(localTimeMs)
  const year = localDate.getUTCFullYear()
  const month = String(localDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(localDate.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function isOnOrAfterAuditFrom(transactionDate: string, auditFromYmd: string): boolean {
  return toLocalYmd(transactionDate) >= auditFromYmd
}

/** Prefer asset code (CR-29); fall back to external name, then display name. */
export function dieselTransactionAssetLabel(tx: {
  asset_id?: string | null
  exception_asset_name?: string | null
  asset_name?: string | null
}): string | null {
  return tx.asset_id ?? tx.exception_asset_name ?? tx.asset_name ?? null
}

function assetLabel(tx: GapTransactionInput): string | null {
  return dieselTransactionAssetLabel(tx)
}

function compareTransactions(a: GapTransactionInput, b: GapTransactionInput): number {
  const dateA = new Date(a.transaction_date).getTime()
  const dateB = new Date(b.transaction_date).getTime()
  if (dateA !== dateB) return dateA - dateB

  const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
  const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
  if (createdA !== createdB) return createdA - createdB

  return a.id.localeCompare(b.id)
}

function isAdjustment(tx: GapTransactionInput): boolean {
  if (!tx.notes) return false
  return tx.notes.includes("[AJUSTE +]") || tx.notes.includes("[AJUSTE -]")
}

function countsTowardRegisteredSum(tx: GapTransactionInput): boolean {
  if (tx.transaction_type !== "consumption") return false
  if (tx.is_transfer) return false
  if (isAdjustment(tx)) return false
  return true
}

export function formatTimeWindow(ms: number): string {
  if (ms <= 0) return "0 min"

  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} d`)
  if (hours > 0) parts.push(`${hours} h`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} min`)

  return parts.join(" ")
}

function formatTxRef(anchor: CuentaLitrosGapAnchor): string {
  const date = new Date(anchor.transaction_date).toLocaleString("es-MX", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  const asset = anchor.asset_label ? ` · ${anchor.asset_label}` : ""
  return `${anchor.transaction_id} (${date}${asset})`
}

function classifyGapType(
  gapLiters: number,
  tolerance: number,
): CuentaLitrosGap["gap_type"] {
  if (Math.abs(gapLiters) <= tolerance) return "within_tolerance"
  if (gapLiters > 0) return "unregistered_dispense"
  return "over_registered"
}

/** Badge/list label — scoped to the anchor interval, not a single tx quantity. */
function buildShortLabel(gapType: CuentaLitrosGap["gap_type"], gapLiters: number): string {
  const rounded = Math.round(Math.abs(gapLiters))
  if (gapType === "within_tolerance") return "Intervalo dentro de tolerancia"
  if (gapType === "unregistered_dispense") return `Intervalo: salida faltante +${rounded}L`
  return `Intervalo: sobre-registro −${rounded}L`
}

export function buildGapNarrative(gap: Pick<
  CuentaLitrosGap,
  | "gap_type"
  | "gap_liters"
  | "meter_delta"
  | "registered_liters"
  | "time_window_label"
  | "prev_anchor"
  | "curr_anchor"
>): string {
  const prevRef = formatTxRef(gap.prev_anchor)
  const currRef = formatTxRef(gap.curr_anchor)
  const roundedGap = Math.round(Math.abs(gap.gap_liters))

  if (gap.gap_type === "within_tolerance") {
    return `El intervalo entre ${prevRef} y ${currRef} está dentro de tolerancia (±2 L). En ${gap.time_window_label} el medidor avanzó ${gap.meter_delta.toFixed(0)} L y hay ${gap.registered_liters.toFixed(0)} L registrados.`
  }

  if (gap.gap_type === "unregistered_dispense") {
    return `Hay una salida faltante de ~${roundedGap} L entre la transacción ${prevRef} y la transacción ${currRef}. En esa ventana de ${gap.time_window_label} el medidor avanzó ${gap.meter_delta.toFixed(0)} L pero solo hay ${gap.registered_liters.toFixed(0)} L registrados.`
  }

  return `Hay un posible sobre-registro de ~${roundedGap} L entre la transacción ${prevRef} y la transacción ${currRef}. En ${gap.time_window_label} el medidor avanzó ${gap.meter_delta.toFixed(0)} L pero hay ${gap.registered_liters.toFixed(0)} L registrados.`
}

function toIntervalTx(tx: GapTransactionInput): CuentaLitrosGapIntervalTx {
  return {
    id: tx.id,
    transaction_id: tx.transaction_id,
    transaction_type: tx.transaction_type,
    transaction_date: tx.transaction_date,
    quantity_liters: tx.quantity_liters,
    cuenta_litros: tx.cuenta_litros,
    asset_label: assetLabel(tx),
    is_transfer: tx.is_transfer,
    notes: tx.notes,
  }
}

function toAnchor(tx: GapTransactionInput): CuentaLitrosGapAnchor {
  return {
    tx_id: tx.id,
    transaction_id: tx.transaction_id,
    transaction_date: tx.transaction_date,
    quantity_liters: tx.quantity_liters,
    cuenta_litros: tx.cuenta_litros as number,
    asset_label: assetLabel(tx),
  }
}

export function buildCuentaLitrosGaps(
  transactions: GapTransactionInput[],
  options: BuildCuentaLitrosGapsOptions,
): CuentaLitrosGap[] {
  if (!options.has_cuenta_litros) return []

  const tolerance = options.tolerance_liters ?? CUENTA_LITROS_VARIANCE_TOLERANCE_LITERS
  const auditFromYmd = options.audit_from ?? CUENTA_LITROS_GAP_AUDIT_FROM
  const sorted = [...transactions]
    .filter((tx) => isOnOrAfterAuditFrom(tx.transaction_date, auditFromYmd))
    .sort(compareTransactions)
  const anchors = sorted.filter((tx) => tx.cuenta_litros != null)

  if (anchors.length < 2) return []

  const gaps: CuentaLitrosGap[] = []

  for (let i = 1; i < anchors.length; i++) {
    const prevAnchorTx = anchors[i - 1]
    const currAnchorTx = anchors[i]

    const prevIndex = sorted.findIndex((tx) => tx.id === prevAnchorTx.id)
    const currIndex = sorted.findIndex((tx) => tx.id === currAnchorTx.id)
    if (prevIndex < 0 || currIndex < 0) continue

    const intervalTxs = sorted.slice(prevIndex + 1, currIndex + 1)
    const registeredLiters = intervalTxs
      .filter(countsTowardRegisteredSum)
      .reduce((sum, tx) => sum + tx.quantity_liters, 0)

    const prevCuenta = prevAnchorTx.cuenta_litros as number
    const currCuenta = currAnchorTx.cuenta_litros as number
    const meterDelta = currCuenta - prevCuenta
    const gapLiters = meterDelta - registeredLiters
    const gapType = classifyGapType(gapLiters, tolerance)

    const prevDate = new Date(prevAnchorTx.transaction_date).getTime()
    const currDate = new Date(currAnchorTx.transaction_date).getTime()
    const timeWindowMs = Math.max(0, currDate - prevDate)
    const timeWindowLabel = formatTimeWindow(timeWindowMs)

    const prev_anchor = toAnchor(prevAnchorTx)
    const curr_anchor = toAnchor(currAnchorTx)

    const gapBase = {
      id: `${prev_anchor.tx_id}__${curr_anchor.tx_id}`,
      warehouse_id: options.warehouse_id,
      prev_anchor,
      curr_anchor,
      time_window_ms: timeWindowMs,
      time_window_label: timeWindowLabel,
      prev_cuenta_litros: prevCuenta,
      curr_cuenta_litros: currCuenta,
      meter_delta: meterDelta,
      registered_liters: registeredLiters,
      gap_liters: gapLiters,
      gap_type: gapType,
      transaction_ids_in_interval: intervalTxs.map((tx) => tx.id),
      transactions_in_interval: intervalTxs.map(toIntervalTx),
    }

    gaps.push({
      ...gapBase,
      narrative: buildGapNarrative(gapBase),
      short_label: buildShortLabel(gapType, gapLiters),
    })
  }

  return gaps
}

export function indexGapsByTransactionId(
  gaps: CuentaLitrosGap[],
): Map<string, CuentaLitrosGap> {
  const map = new Map<string, CuentaLitrosGap>()

  for (const gap of gaps) {
    map.set(gap.curr_anchor.tx_id, gap)
    map.set(gap.prev_anchor.tx_id, gap)

    for (const txId of gap.transaction_ids_in_interval) {
      if (!map.has(txId)) {
        map.set(txId, gap)
      }
    }
  }

  return map
}

export function sumUnregisteredLiters(gaps: CuentaLitrosGap[]): number {
  return gaps
    .filter((g) => g.gap_type === "unregistered_dispense")
    .reduce((sum, g) => sum + g.gap_liters, 0)
}

export function getSignificantGaps(gaps: CuentaLitrosGap[]): CuentaLitrosGap[] {
  return gaps.filter((g) => g.gap_type !== "within_tolerance")
}
