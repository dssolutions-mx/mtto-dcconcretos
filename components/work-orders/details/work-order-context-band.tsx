"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WorkOrderOriginData } from "@/lib/work-orders/build-origin-data"
import { WorkOrderOriginSection } from "@/components/work-orders/details/work-order-origin-section"

interface WorkOrderContextBandProps {
  origin: WorkOrderOriginData
  workOrderType: string | null
  asset:
    | {
        id: string
        asset_id?: string | null
        name?: string | null
        location?: string | null
        current_hours?: number | null
      }
    | null
}

export function WorkOrderContextBand({
  origin,
  workOrderType,
  asset,
}: WorkOrderContextBandProps) {
  return (
    <Card>
      <CardContent className="px-4 py-4">
        <div
          className={cn(
            "grid gap-4 md:gap-5",
            asset
              ? "md:grid-cols-[minmax(220px,0.95fr)_minmax(0,1.8fr)]"
              : "grid-cols-1"
          )}
        >
          <div className={cn(asset && "md:border-r md:pr-5")}>
            <WorkOrderOriginSection origin={origin} workOrderType={workOrderType} />
          </div>

          {asset && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Activo
                </p>
                <p className="text-sm font-medium">{asset.asset_id || "—"}</p>
              </div>

              {asset.name && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Descripción
                  </p>
                  <p className="text-sm text-muted-foreground">{asset.name}</p>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ubicación
                </p>
                <p className="text-sm">{asset.location || "No especificada"}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Horas actuales
                </p>
                <p className="text-sm">{Number(asset.current_hours) || 0} hrs</p>
              </div>

              <div className="xl:col-span-4">
                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                  <Link href={`/activos/${asset.id}`}>Ver detalle completo</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
