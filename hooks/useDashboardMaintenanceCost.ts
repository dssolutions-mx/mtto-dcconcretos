"use client"

import { useMemo } from "react"
import useSWR from "swr"

interface MonthCosts {
  maintenanceCost: number
  dieselCost: number
}

export interface DashboardMaintenanceCostResult {
  current: MonthCosts
  lastMonth: MonthCosts | null
  isLoading: boolean
  /** Revalidate KPI totals (e.g. after manual cost adjustments). */
  refresh: () => void
}

/**
 * Fetches monthly maintenance + diesel costs from the gerencial ingresos-gastos API.
 * Sums diesel_total and mantto_total across all plants for the current user's scope.
 *
 * Client caching: SWR dedupes identical requests (`dedupingInterval` 2m) and refetches on
 * window focus. The API uses a short-lived server cache for rollup reads only: the cached
 * callback uses the service-role client (not the cookie session); auth still scopes which
 * plant IDs are requested before that read.
 *
 * Production TTFB: rollup read is on by default; keep snapshots fresh via pg_cron
 * (`call_refresh_ingresos_kpi_rollup`) so this POST usually hits the DB rollup, not full compute.
 */
function aggregateFromResponse(data: unknown): { current: MonthCosts; lastMonth: MonthCosts | null } {
  const plants: { mantto_total?: unknown; diesel_total?: unknown }[] =
    (data as { plants?: typeof plants })?.plants ?? []
  const current = plants.reduce(
    (acc, p) => ({
      maintenanceCost: acc.maintenanceCost + Number(p.mantto_total ?? 0),
      dieselCost: acc.dieselCost + Number(p.diesel_total ?? 0),
    }),
    { maintenanceCost: 0, dieselCost: 0 }
  )

  const prevPlants: typeof plants = (data as { previousMonth?: { plants?: typeof plants } })?.previousMonth
    ?.plants ?? []
  if (prevPlants.length === 0) {
    return { current, lastMonth: null }
  }
  const lastMonth = prevPlants.reduce(
    (acc, p) => ({
      maintenanceCost: acc.maintenanceCost + Number(p.mantto_total ?? 0),
      dieselCost: acc.dieselCost + Number(p.diesel_total ?? 0),
    }),
    { maintenanceCost: 0, dieselCost: 0 }
  )
  return { current, lastMonth }
}

async function fetchDashboardMaintenanceCost(month: string): Promise<{
  current: MonthCosts
  lastMonth: MonthCosts | null
}> {
  const res = await fetch("/api/reports/gerencial/ingresos-gastos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      month,
      businessUnitId: null,
      plantId: null,
      skipPreviousMonth: true,
      costsOnly: true,
    }),
  })

  if (!res.ok) {
    throw new Error(`ingresos-gastos KPI: HTTP ${res.status}`)
  }

  const json = await res.json()
  return aggregateFromResponse(json)
}

export function useDashboardMaintenanceCost(): DashboardMaintenanceCostResult {
  const month = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  }, [])

  const { data, isLoading, mutate } = useSWR(
    ["dashboard-maintenance-cost", month] as const,
    ([, m]) => fetchDashboardMaintenanceCost(m),
    {
      dedupingInterval: 120_000,
      revalidateOnFocus: true,
      shouldRetryOnError: true,
      errorRetryCount: 2,
      onError(err) {
        console.error("[useDashboardMaintenanceCost]", err)
      },
    }
  )

  const current = data?.current ?? { maintenanceCost: 0, dieselCost: 0 }
  const lastMonth = data?.lastMonth ?? null

  return {
    current,
    lastMonth,
    isLoading,
    refresh: () => {
      void mutate()
    },
  }
}
