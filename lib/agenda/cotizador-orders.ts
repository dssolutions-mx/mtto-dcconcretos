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
  /** Row is the standalone SERVICIO DE BOMBEO line item. */
  is_pump_only: boolean
  /** Mirrors Cotizador OrdersList: any item with has_pump_service or bombeo line. */
  has_pumping_service: boolean
  /** Planned pump m³ for the order (from order_items.pump_volume). */
  pump_volume_planned: number | null
}

export type RawOrderItem = {
  product_type?: string | null
  volume?: number | null
  pump_volume?: number | null
  has_pump_service?: boolean | null
  has_empty_truck_charge?: boolean | null
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

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** @deprecated Prefer orderItemHasPumpService — kept for tests naming parity. */
export function isPumpProductType(productType: string | null | undefined): boolean {
  return isPumpServiceProductType(productType)
}

/** Same rules as cotizaciones-concreto OrdersList / orderService.getOrders. */
export function isPumpServiceProductType(productType: string | null | undefined): boolean {
  const pt = (productType ?? "").toString()
  return (
    pt === "SERVICIO DE BOMBEO" ||
    pt.toLowerCase().includes("bombeo") ||
    pt.toLowerCase().includes("pump")
  )
}

export function isEmptyTruckChargeItem(item: RawOrderItem): boolean {
  const productType = (item.product_type ?? "").toString()
  return (
    item.has_empty_truck_charge === true ||
    productType === "VACÍO DE OLLA" ||
    productType === "EMPTY_TRUCK_CHARGE"
  )
}

export function isAdditionalProductType(productType: string | null | undefined): boolean {
  return (productType ?? "").toString().startsWith("PRODUCTO ADICIONAL:")
}

export function orderItemHasPumpService(item: RawOrderItem): boolean {
  return item.has_pump_service === true || isPumpServiceProductType(item.product_type)
}

export function isConcreteOrderItem(item: RawOrderItem): boolean {
  return (
    !isEmptyTruckChargeItem(item) &&
    !isPumpServiceProductType(item.product_type) &&
    !isAdditionalProductType(item.product_type)
  )
}

export type OrderPumpSummary = {
  hasPumpingService: boolean
  pumpVolumePlanned: number | null
  hasConcreteLine: boolean
  isPumpOnly: boolean
}

/** Aggregate pump flags/volumes the same way Cotizador enriches its order list. */
export function summarizeOrderPump(items: RawOrderItem[]): OrderPumpSummary {
  let pumpVolumePlanned = 0
  let hasPumpingService = false
  let hasConcreteLine = false

  for (const item of items) {
    if (isConcreteOrderItem(item)) {
      hasConcreteLine = true
    }

    if (!orderItemHasPumpService(item)) continue

    hasPumpingService = true
    const pumpVolumeItem = toNumber(item.pump_volume) ?? 0
    const volume = toNumber(item.volume) ?? 0

    if (pumpVolumeItem > 0) {
      pumpVolumePlanned += pumpVolumeItem
    } else if (isPumpServiceProductType(item.product_type) && volume > 0) {
      pumpVolumePlanned += volume
    }
  }

  return {
    hasPumpingService,
    pumpVolumePlanned: pumpVolumePlanned > 0 ? pumpVolumePlanned : null,
    hasConcreteLine,
    isPumpOnly: hasPumpingService && !hasConcreteLine,
  }
}

function baseRow(
  order: RawOrder,
  summary: OrderPumpSummary,
): Omit<
  CotizadorOrderItemRow,
  "product_type" | "volume" | "concrete_volume_delivered" | "is_pump_only"
> {
  return {
    order_id: order.id,
    order_number: order.order_number,
    delivery_date: order.delivery_date,
    delivery_time: order.delivery_time ?? null,
    construction_site: order.construction_site ?? null,
    client_name: order.client?.business_name ?? null,
    plant_id: order.plant_id,
    plant_name: order.plant?.name ?? null,
    order_status: order.order_status,
    has_pumping_service: summary.hasPumpingService,
    pump_volume_planned: summary.pumpVolumePlanned,
  }
}

/**
 * Flattens Cotizador orders into planning rows using order_items.has_pump_service
 * (not remisiones). Concrete recipe lines with has_pump_service=true mean the pump
 * truck is needed even without a separate bombeo remisión.
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

    const summary = summarizeOrderPump(items)
    const shared = baseRow(order, summary)

    for (const item of items) {
      if (isConcreteOrderItem(item)) {
        rows.push({
          ...shared,
          product_type: item.product_type ?? null,
          volume: toNumber(item.volume),
          concrete_volume_delivered: toNumber(item.concrete_volume_delivered),
          is_pump_only: false,
        })
        continue
      }

      const isPumpLine = isPumpServiceProductType(item.product_type)
      if (isPumpLine && (summary.isPumpOnly || includePumpLines)) {
        rows.push({
          ...shared,
          product_type: item.product_type ?? null,
          volume: toNumber(item.volume),
          concrete_volume_delivered: toNumber(item.concrete_volume_delivered),
          is_pump_only: true,
        })
      }
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
