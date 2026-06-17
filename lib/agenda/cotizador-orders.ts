const PUMP_PRODUCT_PATTERN = /pump|bombeo|bomba/i

export type CotizadorOrderItemRow = {
  order_id: string
  order_number: string
  delivery_date: string
  delivery_time: string | null
  construction_site: string | null
  client_name: string | null
  plant_id: string
  plant_name: string | null
  product_type: string | null
  volume: number | null
  concrete_volume_delivered: number | null
  order_status: string
  is_pump_only: boolean
  /** True when the order includes bombeo/pump lines (even if this row is concrete). */
  has_pumping_service: boolean
}

type RawOrderItem = {
  product_type?: string | null
  volume?: number | null
  concrete_volume_delivered?: number | null
}

type RawOrder = {
  id: string
  order_number: string
  delivery_date: string
  delivery_time?: string | null
  construction_site?: string | null
  plant_id: string
  order_status: string
  plant?: { id?: string; name?: string | null } | null
  client?: { business_name?: string | null } | null
  order_items?: RawOrderItem[] | null
}

export function isPumpProductType(productType: string | null | undefined): boolean {
  if (!productType) return false
  return PUMP_PRODUCT_PATTERN.test(productType)
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Flattens Cotizador orders into planning rows.
 * - Concrete lines are always included.
 * - Pump/bombeo lines are included for pump-only orders (machine deployment) and when
 *   `includePumpLines` is true (mixed orders also show their bombeo line).
 */
export function flattenCotizadorOrders(
  orders: RawOrder[],
  options?: { includePumpLines?: boolean },
): CotizadorOrderItemRow[] {
  const includePumpLines = options?.includePumpLines ?? false
  const rows: CotizadorOrderItemRow[] = []

  for (const order of orders) {
    const items = order.order_items ?? []
    if (items.length === 0) continue

    const pumpFlags = items.map((item) => isPumpProductType(item.product_type))
    const hasPumpingService = pumpFlags.some(Boolean)
    const isOrderPumpOnly = pumpFlags.every(Boolean)

    for (const [idx, item] of items.entries()) {
      const isPump = pumpFlags[idx] ?? false
      if (isPump && !includePumpLines && !isOrderPumpOnly) continue

      rows.push({
        order_id: order.id,
        order_number: order.order_number,
        delivery_date: order.delivery_date,
        delivery_time: order.delivery_time ?? null,
        construction_site: order.construction_site ?? null,
        client_name: order.client?.business_name ?? null,
        plant_id: order.plant_id,
        plant_name: order.plant?.name ?? null,
        product_type: item.product_type ?? null,
        volume: toNumber(item.volume),
        concrete_volume_delivered: toNumber(item.concrete_volume_delivered),
        order_status: order.order_status,
        is_pump_only: isPump,
        has_pumping_service: hasPumpingService,
      })
    }
  }

  return rows.sort((a, b) => {
    const dateCmp = a.delivery_date.localeCompare(b.delivery_date)
    if (dateCmp !== 0) return dateCmp
    const timeCmp = (a.delivery_time ?? "").localeCompare(b.delivery_time ?? "")
    if (timeCmp !== 0) return timeCmp
    return a.order_number.localeCompare(b.order_number)
  })
}
