import type { AssetTireInstallation, Tire, TireEvent } from '@/types/tires'

export function computeTireKmTraveled(installation: AssetTireInstallation): number | null {
  if (installation.km_at_install == null) return null
  const endKm = installation.removed_at
    ? installation.km_at_remove
    : null
  if (endKm == null) return null
  return Math.max(0, endKm - installation.km_at_install)
}

export function computeTireTotalCost(
  tire: Tire,
  events: TireEvent[]
): number {
  const eventCosts = events
    .filter((e) => e.tire_id === tire.id)
    .reduce((sum, e) => sum + (e.cost ?? 0), 0)
  return (tire.purchase_cost ?? 0) + eventCosts
}

export function computeCostPerKm(totalCost: number, km: number | null): number | null {
  if (km == null || km <= 0) return null
  return totalCost / km
}
