"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isPressureOutOfRange, isTreadLow } from "@/lib/tires/positions"
import { DEFAULT_TIRE_POSITIONS } from "@/lib/tires/positions"
import type { AssetTireInstallation } from "@/types/tires"
import { AlertTriangle } from "lucide-react"

interface TirePositionMapProps {
  activeInstallations: AssetTireInstallation[]
}

export function TirePositionMap({ activeInstallations }: TirePositionMapProps) {
  const byPosition = new Map(
    activeInstallations.map((i) => [i.position_code, i])
  )

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {DEFAULT_TIRE_POSITIONS.map((pos) => {
        const inst = byPosition.get(pos.code)
        const tire = inst?.tire
        const reading = inst?.latest_reading
        const treadLow =
          tire && isTreadLow(reading?.tread_depth_mm, tire.min_tread_mm)
        const pressureBad = isPressureOutOfRange(reading?.pressure_psi)

        return (
          <Card
            key={pos.code}
            className={
              inst
                ? treadLow || pressureBad
                  ? "border-amber-500"
                  : "border-primary/30"
                : "border-dashed opacity-70"
            }
          >
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                <span>{pos.label}</span>
                {(treadLow || pressureBad) && (
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0 text-sm">
              {inst && tire ? (
                <div className="space-y-1">
                  <p className="font-medium">
                    {tire.brand} {tire.size}
                  </p>
                  {tire.serial_number && (
                    <p className="text-muted-foreground text-xs">DOT: {tire.serial_number}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="outline">{tire.condition}</Badge>
                    {reading?.tread_depth_mm != null && (
                      <Badge variant={treadLow ? "destructive" : "secondary"}>
                        {reading.tread_depth_mm} mm
                      </Badge>
                    )}
                    {reading?.pressure_psi != null && (
                      <Badge variant={pressureBad ? "destructive" : "secondary"}>
                        {reading.pressure_psi} psi
                      </Badge>
                    )}
                  </div>
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
