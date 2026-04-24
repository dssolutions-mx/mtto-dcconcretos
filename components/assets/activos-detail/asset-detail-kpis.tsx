"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Info } from "lucide-react"
import type {
  MaintenanceHistoryMeterRow,
  MaintenanceIntervalMeterRow,
  MaintenanceUnit,
  MaintenanceUnitSource,
} from "@/lib/utils/maintenance-units"
import {
  getCurrentValue,
  getMaintenanceValue,
  getMaxPreventiveMeterReading,
  getLastPreventiveHistoryAtMaxMeter,
  getRawModelMaintenanceUnit,
  getUnitLabel,
  getUnitDisplayName,
} from "@/lib/utils/maintenance-units"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type AssetKpiSource = MaintenanceUnitSource & {
  current_hours?: unknown
  current_kilometers?: unknown
}

interface AssetDetailKpisProps {
  asset: AssetKpiSource | null
  maintenanceUnit: MaintenanceUnit
  maintenanceHistory: MaintenanceHistoryMeterRow[]
  combinedMaintenanceHistory: MaintenanceHistoryMeterRow[] | null
  maintenanceIntervals: MaintenanceIntervalMeterRow[]
  pendingTasksCount: number
}

export function AssetDetailKpis({
  asset,
  maintenanceUnit,
  maintenanceHistory,
  combinedMaintenanceHistory,
  maintenanceIntervals = [],
  pendingTasksCount,
}: AssetDetailKpisProps) {
  const effectiveHistory = combinedMaintenanceHistory ?? maintenanceHistory
  const hasIntervals = maintenanceIntervals.length > 0
  const rawModelUnit = asset ? getRawModelMaintenanceUnit(asset) : null

  const sinceLastMant = useMemo(() => {
    if (!asset) {
      return {
        mode: "legacy" as const,
        display: "—",
        subcopy: null as string | null,
        tooltip: "Sin activo cargado.",
      }
    }
    const currentVal = getCurrentValue(asset, maintenanceUnit)
    const unitLabel = getUnitLabel(maintenanceUnit)

    if (hasIntervals) {
      const lastPreventiveMax = getMaxPreventiveMeterReading(
        effectiveHistory,
        maintenanceIntervals,
        maintenanceUnit
      )
      if (lastPreventiveMax > 0) {
        const delta = Math.max(0, currentVal - lastPreventiveMax)
        const atMax = getLastPreventiveHistoryAtMaxMeter(
          effectiveHistory,
          maintenanceIntervals,
          maintenanceUnit
        )
        const lastPrevDate =
          atMax?.date &&
          format(new Date(atMax.date), "d MMM yyyy", { locale: es })
        return {
          mode: "preventive" as const,
          display: `${delta}${unitLabel}`,
          subcopy:
            delta === 0 && lastPrevDate
              ? `Último preventivo: ${lastPrevDate}`
              : delta === 0
                ? "Misma lectura que el último preventivo"
                : null,
          tooltip:
            "Medidor desde el último mantenimiento preventivo registrado (mayor lectura entre preventivos del plan). Los correctivos no reinician este valor.",
        }
      }
      return {
        mode: "preventive" as const,
        display: "—",
        subcopy: "Sin registro preventivo con medidor",
        tooltip:
          "No hay preventivos del plan con horas o kilómetros registrados. Este valor no incluye correctivos.",
      }
    }

    if (effectiveHistory.length > 0) {
      const lastAny = getMaintenanceValue(effectiveHistory[0], maintenanceUnit)
      if (lastAny > 0 && currentVal > 0) {
        const delta = Math.max(0, currentVal - lastAny)
        const d = effectiveHistory[0]?.date
        const lastDate =
          d && format(new Date(d), "d MMM yyyy", { locale: es })
        return {
          mode: "legacy" as const,
          display: `${delta}${unitLabel}`,
          subcopy:
            delta === 0 && lastDate
              ? `Último registro: ${lastDate}`
              : delta === 0
                ? "Misma lectura que el último registro"
                : null,
          tooltip:
            "Medidor desde la lectura del último evento en historial (por fecha). El modelo no tiene intervalos de plan cargados; al configurarlos, este valor usará solo preventivos.",
        }
      }
    }

    return {
      mode: "legacy" as const,
      display: `0${unitLabel}`,
      subcopy: null as string | null,
      tooltip:
        "Sin historial de mantenimiento o sin lecturas de medidor en el último registro.",
    }
  }, [asset, effectiveHistory, hasIntervals, maintenanceIntervals, maintenanceUnit])

  if (!asset) return null

  const secondaryValue =
    maintenanceUnit === "kilometers"
      ? asset?.current_hours || 0
      : asset?.current_kilometers || 0
  const secondaryLabel = maintenanceUnit === "kilometers" ? "Horas" : "Kilómetros"

  const primaryLabel =
    getUnitDisplayName(maintenanceUnit).charAt(0).toUpperCase() +
    getUnitDisplayName(maintenanceUnit).slice(1) +
    " Operación"

  const bothModelsPrimaryHint =
    rawModelUnit === "both" ? (
      <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5 leading-tight px-1">
        Preventivos y este KPI usan horas como medidor principal; kilómetros son referencia.
      </div>
    ) : null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-4 md:mb-6">
      <div className="text-center">
        <div className="text-3xl md:text-4xl font-bold text-slate-900">
          {getCurrentValue(asset, maintenanceUnit)}
          {getUnitLabel(maintenanceUnit)}
        </div>
        <div className="text-xs sm:text-sm text-slate-600 mt-1">{primaryLabel}</div>
        {bothModelsPrimaryHint}
      </div>
      <div className="text-center">
        <div className="text-2xl sm:text-3xl font-bold text-slate-900">
          {secondaryValue}
        </div>
        <div className="text-xs sm:text-sm text-slate-600 mt-1">{secondaryLabel}</div>
      </div>
      <div className="text-center">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help outline-none rounded-md mx-auto max-w-[11rem] sm:max-w-none">
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 inline-flex items-center justify-center gap-1">
                  <span>{sinceLastMant.display}</span>
                  <Info
                    className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 shrink-0"
                    aria-hidden
                  />
                </div>
                <div className="text-xs sm:text-sm text-slate-600 mt-1 inline-flex items-center gap-1 justify-center flex-wrap">
                  Desde Último Mant.
                  {sinceLastMant.mode === "preventive" ? (
                    <span className="text-[10px] text-slate-400 font-normal">(preventivo)</span>
                  ) : null}
                </div>
                {sinceLastMant.subcopy ? (
                  <div className="text-[10px] sm:text-xs text-slate-500 mt-1 leading-snug px-0.5">
                    {sinceLastMant.subcopy}
                  </div>
                ) : null}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-left text-sm">
              {sinceLastMant.tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
