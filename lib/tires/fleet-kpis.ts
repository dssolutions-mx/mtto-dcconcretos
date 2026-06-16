import { computeCostPerKm, computeTireTotalCost } from '@/lib/tires/cost-report'
import type { Tire, TireEvent } from '@/types/tires'

export interface FleetOperationalKpis {
  avgCostPerKm: number | null
  tiresWithCostData: number
  readingCoverage7dPct: number
  mountedWithRecentReading: number
  totalMounted: number
  warehouseCount: number
}

export function computeReadingCoverage7d(input: {
  mountedInstallationIds: string[]
  readingsByInstallation: Map<string, { read_at: string }>
  now?: Date
}): { pct: number; withReading: number; total: number } {
  const now = input.now ?? new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - 7)

  const total = input.mountedInstallationIds.length
  if (total === 0) return { pct: 0, withReading: 0, total: 0 }

  let withReading = 0
  for (const instId of input.mountedInstallationIds) {
    const reading = input.readingsByInstallation.get(instId)
    if (reading && new Date(reading.read_at) >= cutoff) {
      withReading++
    }
  }

  return {
    pct: Math.round((withReading / total) * 100),
    withReading,
    total,
  }
}

export function computeFleetAvgCostPerKm(input: {
  tires: Tire[]
  events: TireEvent[]
  kmByTireId: Map<string, number>
}): { avg: number | null; count: number } {
  const values: number[] = []

  for (const tire of input.tires) {
    const tireEvents = input.events.filter((e) => e.tire_id === tire.id)
    const totalCost = computeTireTotalCost(tire, tireEvents)
    const km = input.kmByTireId.get(tire.id) ?? null
    const cpk = computeCostPerKm(totalCost, km)
    if (cpk != null) values.push(cpk)
  }

  if (values.length === 0) return { avg: null, count: 0 }
  const avg = values.reduce((s, v) => s + v, 0) / values.length
  return { avg, count: values.length }
}
