"use client"

import type { MaintenanceUnit } from "@/lib/utils/maintenance-units"
import {
  getCurrentValue,
  getMaintenanceValue,
  getUnitLabel,
  getUnitDisplayName,
} from "@/lib/utils/maintenance-units"

interface AssetDetailKpisProps {
  asset: any
  maintenanceUnit: MaintenanceUnit
  maintenanceHistory: any[]
  combinedMaintenanceHistory: any[] | null
  pendingTasksCount: number
}

export function AssetDetailKpis({
  asset,
  maintenanceUnit,
  maintenanceHistory,
  combinedMaintenanceHistory,
  pendingTasksCount,
}: AssetDetailKpisProps) {
  if (!asset) return null

  const effectiveHistory = combinedMaintenanceHistory ?? maintenanceHistory
  const hoursSinceLast = (() => {
    if (effectiveHistory.length > 0) {
      const lastMaintenanceValue = getMaintenanceValue(effectiveHistory[0], maintenanceUnit)
      const currentVal = getCurrentValue(asset, maintenanceUnit)
      if (lastMaintenanceValue > 0 && currentVal > 0) {
        return `${currentVal - lastMaintenanceValue}${getUnitLabel(maintenanceUnit)}`
      }
    }
    return `0${getUnitLabel(maintenanceUnit)}`
  })()

  const secondaryValue =
    maintenanceUnit === "kilometers"
      ? asset?.current_hours || 0
      : asset?.current_kilometers || 0
  const secondaryLabel = maintenanceUnit === "kilometers" ? "Horas" : "Kilómetros"

  const primaryLabel =
    getUnitDisplayName(maintenanceUnit).charAt(0).toUpperCase() +
    getUnitDisplayName(maintenanceUnit).slice(1) +
    " Operación"

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-4 md:mb-6">
      <div className="text-center">
        <div className="text-3xl md:text-4xl font-bold text-slate-900">
          {getCurrentValue(asset, maintenanceUnit)}
          {getUnitLabel(maintenanceUnit)}
        </div>
        <div className="text-xs sm:text-sm text-slate-600 mt-1">{primaryLabel}</div>
      </div>
      <div className="text-center">
        <div className="text-2xl sm:text-3xl font-bold text-slate-900">
          {secondaryValue}
        </div>
        <div className="text-xs sm:text-sm text-slate-600 mt-1">{secondaryLabel}</div>
      </div>
      <div className="text-center">
        <div className="text-2xl sm:text-3xl font-bold text-slate-900">
          {hoursSinceLast}
        </div>
        <div className="text-xs sm:text-sm text-slate-600 mt-1">Desde Último Mant.</div>
      </div>
      <div className="text-center">
        <div
          className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1 rounded-full text-2xl sm:text-3xl font-bold ${
            pendingTasksCount > 0
              ? "text-amber-600 bg-amber-50 ring-2 ring-amber-400"
              : "text-slate-900"
          }`}
        >
          {pendingTasksCount}
        </div>
        <div className="text-xs sm:text-sm text-slate-600 mt-1">Tareas Pendientes</div>
      </div>
    </div>
  )
}
