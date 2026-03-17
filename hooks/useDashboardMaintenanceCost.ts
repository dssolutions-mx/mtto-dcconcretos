"use client"

import { useState, useEffect, useCallback } from "react"

interface MonthCosts {
  maintenanceCost: number
  dieselCost: number
}

export interface DashboardMaintenanceCostResult {
  current: MonthCosts
  lastMonth: MonthCosts | null
  isLoading: boolean
}

/**
 * Fetches monthly maintenance + diesel costs from the gerencial ingresos-gastos API.
 * Sums diesel_total and mantto_total across all plants for the current user's scope.
 * Uses POST /api/reports/gerencial/ingresos-gastos — same API as the gerencial report page.
 */
export function useDashboardMaintenanceCost(): DashboardMaintenanceCostResult {
  const [current, setCurrent] = useState<MonthCosts>({ maintenanceCost: 0, dieselCost: 0 })
  const [lastMonth, setLastMonth] = useState<MonthCosts | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setIsLoading(true)

      // Current month in YYYY-MM format
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

      const res = await fetch("/api/reports/gerencial/ingresos-gastos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, businessUnitId: null, plantId: null }),
      })

      if (!res.ok) {
        console.error("[useDashboardMaintenanceCost] API error:", res.status)
        return
      }

      const data = await res.json()

      // Sum diesel_total and mantto_total across all current-month plants
      const plants: any[] = data?.plants ?? []
      const currentTotals = plants.reduce(
        (acc: MonthCosts, p: any) => ({
          maintenanceCost: acc.maintenanceCost + Number(p.mantto_total ?? 0),
          dieselCost: acc.dieselCost + Number(p.diesel_total ?? 0),
        }),
        { maintenanceCost: 0, dieselCost: 0 }
      )
      setCurrent(currentTotals)

      // Previous month comparison (API returns previousMonth.plants)
      const prevPlants: any[] = data?.previousMonth?.plants ?? []
      if (prevPlants.length > 0) {
        const prevTotals = prevPlants.reduce(
          (acc: MonthCosts, p: any) => ({
            maintenanceCost: acc.maintenanceCost + Number(p.mantto_total ?? 0),
            dieselCost: acc.dieselCost + Number(p.diesel_total ?? 0),
          }),
          { maintenanceCost: 0, dieselCost: 0 }
        )
        setLastMonth(prevTotals)
      } else {
        setLastMonth(null)
      }
    } catch (err) {
      console.error("[useDashboardMaintenanceCost] Unexpected error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { current, lastMonth, isLoading }
}
