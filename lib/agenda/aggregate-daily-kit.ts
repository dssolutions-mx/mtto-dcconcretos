import type { PartAvailability } from "@/lib/services/stock-service"

export type RawPartLine = {
  part_id?: string | null
  part_number?: string | null
  name?: string | null
  quantity?: number | null
  plant_id?: string | null
  source_work_order_id?: string
  source_order_id?: string
}

export function plantPartAvailabilityKey(plantId: string, partId: string): string {
  return `${plantId}:${partId}`
}

function lookupPartAvailability(
  line: RawPartLine,
  availabilityMap: Map<string, PartAvailability>,
): PartAvailability | undefined {
  if (!line.part_id) return undefined
  if (line.plant_id) {
    return availabilityMap.get(plantPartAvailabilityKey(line.plant_id, line.part_id))
  }
  return availabilityMap.get(line.part_id)
}

export type ConsolidatedKitLine = {
  key: string
  part_id: string | null
  part_number: string
  name: string
  required_quantity: number
  work_order_ids: string[]
  order_ids: string[]
  total_available: number | null
  sufficient: boolean | null
  available_by_warehouse: PartAvailability["available_by_warehouse"]
}

type WorkOrderPartsSource = {
  id: string
  order_id: string
  asset_id: string | null
  required_parts: unknown
  required_tasks: unknown
}

function parseJsonArray<T>(value: unknown): T[] {
  if (!value) return []
  if (Array.isArray(value)) return value as T[]
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }
  return []
}

function partKey(part: RawPartLine): string {
  const plantPrefix = part.plant_id ? `plant:${part.plant_id}:` : ""
  if (part.part_id) return `${plantPrefix}id:${part.part_id}`
  const num = (part.part_number ?? "").trim().toUpperCase()
  const name = (part.name ?? "").trim().toUpperCase()
  return `${plantPrefix}manual:${num}|${name}`
}

export function extractPartsFromWorkOrder(
  wo: WorkOrderPartsSource,
  plantId?: string | null,
): RawPartLine[] {
  const lines: RawPartLine[] = []

  for (const part of parseJsonArray<RawPartLine>(wo.required_parts)) {
    const qty = Number(part.quantity ?? 0)
    if (qty <= 0 && !part.name && !part.part_number && !part.part_id) continue
    lines.push({
      ...part,
      quantity: qty > 0 ? qty : 1,
      plant_id: plantId ?? part.plant_id ?? null,
      source_work_order_id: wo.id,
      source_order_id: wo.order_id,
    })
  }

  for (const task of parseJsonArray<{ parts?: RawPartLine[] }>(wo.required_tasks)) {
    for (const part of task.parts ?? []) {
      const qty = Number(part.quantity ?? 0)
      if (qty <= 0 && !part.name && !part.part_number && !part.part_id) continue
      lines.push({
        ...part,
        quantity: qty > 0 ? qty : 1,
        plant_id: plantId ?? part.plant_id ?? null,
        source_work_order_id: wo.id,
        source_order_id: wo.order_id,
      })
    }
  }

  return lines
}

export function consolidateKitLines(
  lines: RawPartLine[],
  availabilityByPartId: Map<string, PartAvailability>,
): ConsolidatedKitLine[] {
  const map = new Map<string, ConsolidatedKitLine>()

  for (const line of lines) {
    const key = partKey(line)
    const qty = Number(line.quantity ?? 0)
    const existing = map.get(key)
    if (existing) {
      existing.required_quantity += qty
      if (line.source_work_order_id && !existing.work_order_ids.includes(line.source_work_order_id)) {
        existing.work_order_ids.push(line.source_work_order_id)
      }
      if (line.source_order_id && !existing.order_ids.includes(line.source_order_id)) {
        existing.order_ids.push(line.source_order_id)
      }
      continue
    }

    const partId = line.part_id ?? null
    const availability = lookupPartAvailability(line, availabilityByPartId)

    map.set(key, {
      key,
      part_id: partId,
      part_number: line.part_number ?? "",
      name: line.name ?? "Sin nombre",
      required_quantity: qty,
      work_order_ids: line.source_work_order_id ? [line.source_work_order_id] : [],
      order_ids: line.source_order_id ? [line.source_order_id] : [],
      total_available: availability?.total_available ?? null,
      sufficient:
        availability != null
          ? availability.total_available >= qty
          : partId
            ? false
            : null,
      available_by_warehouse: availability?.available_by_warehouse ?? [],
    })
  }

  return [...map.values()].sort((a, b) => {
    const nameCmp = a.name.localeCompare(b.name, "es")
    if (nameCmp !== 0) return nameCmp
    return a.part_number.localeCompare(b.part_number, "es")
  })
}

export function recomputeKitSufficiency(lines: ConsolidatedKitLine[]): ConsolidatedKitLine[] {
  return lines.map((line) => {
    if (!line.part_id || line.total_available == null) return line
    return {
      ...line,
      sufficient: line.total_available >= line.required_quantity,
    }
  })
}
