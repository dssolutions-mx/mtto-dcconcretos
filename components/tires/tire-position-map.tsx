"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatTirePrimaryId, formatTireSecondaryDot } from "@/lib/tires/display"
import {
  getTireHealthStatus,
  treadFraction,
  TIRE_STATUS_VISUALS,
} from "@/lib/tires/status"
import type { AssetTireInstallation, TirePosition, TireThresholds } from "@/types/tires"
import { AlertTriangle } from "lucide-react"

interface TirePositionMapProps {
  positions: TirePosition[]
  activeInstallations: AssetTireInstallation[]
  thresholds?: TireThresholds
}

export function TirePositionMap({ positions, activeInstallations, thresholds }: TirePositionMapProps) {
  const byPosition = new Map(activeInstallations.map((i) => [i.position_code, i]))

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {positions.map((pos) => {
        const inst = byPosition.get(pos.code)
        const tire = inst?.tire
        const reading = inst?.latest_reading
        const dot = tire ? formatTireSecondaryDot(tire) : null
        const status = getTireHealthStatus(inst, thresholds)
        const visual = TIRE_STATUS_VISUALS[status]
        const attention = status === "warning" || status === "critical"
        const frac = treadFraction(reading?.tread_depth_mm)

        return (
          <Card
            key={pos.code}
            className={cn(
              "border-l-4 transition-colors",
              inst ? visual.borderClass : "border-l-transparent border-dashed opacity-80"
            )}
          >
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
                <span>{pos.label}</span>
                {attention ? (
                  <AlertTriangle className={cn("h-4 w-4 shrink-0", visual.textClass)} />
                ) : (
                  inst && (
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                        visual.badgeClass
                      )}
                    >
                      {visual.label}
                    </span>
                  )
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0 text-sm">
              {inst && tire ? (
                <div className="space-y-2">
                  <p className="font-mono text-sm font-medium">{formatTirePrimaryId(tire)}</p>
                  <p className="text-sm text-muted-foreground">
                    {tire.brand} {tire.size}
                  </p>
                  {dot && (
                    <p className="font-mono text-xs text-muted-foreground">
                      DOT: {dot}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="capitalize">
                      {tire.condition}
                    </Badge>
                    {reading?.tread_depth_mm != null && (
                      <Badge variant="outline" className={visual.badgeClass}>
                        {reading.tread_depth_mm} mm
                      </Badge>
                    )}
                    {reading?.pressure_psi != null && (
                      <Badge variant="outline">{reading.pressure_psi} psi</Badge>
                    )}
                  </div>
                  {frac != null && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${frac * 100}%`, backgroundColor: visual.stroke }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Vacío</p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
