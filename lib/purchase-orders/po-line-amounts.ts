/**
 * Totales por renglón según fulfill_from (mismo criterio que formularios de OC).
 */

export interface PoLineAmountSplit {
  inventoryTotal: number
  purchaseTotal: number
  inventoryLineCount: number
  purchaseLineCount: number
}

function lineTotal(item: Record<string, unknown>): number {
  const tp = item.total_price
  if (tp != null && tp !== "") {
    const n = Number(tp)
    if (!Number.isNaN(n)) return n
  }
  const q = Number(item.quantity) || 0
  const u =
    Number(item.unit_price ?? item.price ?? item.unitPrice ?? 0) || 0
  return q * u
}

export function splitPoLineTotalsByFulfillFrom(items: unknown): PoLineAmountSplit {
  let inventoryTotal = 0
  let purchaseTotal = 0
  let inventoryLineCount = 0
  let purchaseLineCount = 0

  let arr: unknown
  try {
    arr = typeof items === "string" ? JSON.parse(items) : items
  } catch {
    return {
      inventoryTotal: 0,
      purchaseTotal: 0,
      inventoryLineCount: 0,
      purchaseLineCount: 0,
    }
  }

  if (!Array.isArray(arr)) {
    return {
      inventoryTotal: 0,
      purchaseTotal: 0,
      inventoryLineCount: 0,
      purchaseLineCount: 0,
    }
  }

  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue
    const item = raw as Record<string, unknown>
    const t = lineTotal(item)
    const ff = item.fulfill_from as string | undefined
    if (ff === "inventory") {
      inventoryTotal += t
      inventoryLineCount += 1
    } else {
      purchaseTotal += t
      purchaseLineCount += 1
    }
  }

  return {
    inventoryTotal,
    purchaseTotal,
    inventoryLineCount,
    purchaseLineCount,
  }
}
