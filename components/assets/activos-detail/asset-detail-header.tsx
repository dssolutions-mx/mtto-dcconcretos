"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import Link from "next/link"
import { Calendar, MapPin, Users, AlertTriangle } from "lucide-react"
import type { AssetWithModel } from "@/types"

interface AssetDetailHeaderProps {
  asset: AssetWithModel | null
  assetId: string
  compositeContext: { composite: any | null; components: any[]; sibling_drift?: Record<string, { hours_stale: boolean; km_stale: boolean }> }
  formatDate: (dateString: string | null) => string
  getStatusBadge: (status: string) => React.ReactNode
  kpis?: React.ReactNode
  actions?: React.ReactNode
}

export function AssetDetailHeader({
  asset,
  assetId,
  compositeContext,
  formatDate,
  getStatusBadge,
  kpis,
  actions,
}: AssetDetailHeaderProps) {
  if (!asset) return null

  return (
    <Card className="border-2 rounded-xl shadow-md transition-colors duration-200">
      <CardHeader className="pb-3 md:pb-4">
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold break-words tracking-tight">
              {asset.name}
            </h1>
            <div className="flex flex-col space-y-1 sm:space-y-0 sm:flex-row sm:items-center sm:gap-2 text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{asset.asset_id}</span>
              <span className="hidden sm:inline">•</span>
              <span className="break-words">
                {asset.model?.manufacturer} {asset.model?.name || "Sin modelo"}
              </span>
              {asset.serial_number && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="break-words">S/N: {asset.serial_number}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 self-start">
            {getStatusBadge(asset.status || "")}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {compositeContext.composite && (
          <div className="mb-4 p-3 border rounded-lg bg-blue-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm">
                <span className="font-semibold">Activo Compuesto</span>{" "}
                {compositeContext.composite.id !== assetId ? (
                  <>
                    — Parte de{" "}
                    <Link
                      className="underline cursor-pointer hover:text-primary transition-colors duration-200"
                      href={`/activos/${compositeContext.composite.id}`}
                    >
                      {compositeContext.composite.name}
                    </Link>
                  </>
                ) : (
                  <span>— Vista unificada</span>
                )}
              </div>
              {compositeContext.composite.id !== assetId && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/activos/${compositeContext.composite.id}`} className="cursor-pointer">
                    Ver vista unificada
                  </Link>
                </Button>
              )}
            </div>
            {compositeContext.components.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {compositeContext.components.map((c: any) => {
                  const drift = compositeContext.sibling_drift?.[c.id]
                  const hasDrift = drift?.hours_stale || drift?.km_stale
                  return (
                    <Link key={c.id} href={`/activos/${c.id}`} className="cursor-pointer">
                      <span className="inline-flex items-center gap-1">
                        <Badge
                          variant={c.id === assetId ? "default" : "outline"}
                          className="cursor-pointer transition-colors duration-200 hover:opacity-90"
                        >
                          {c.asset_id || c.name}
                        </Badge>
                        {hasDrift && (
                          <span
                            title={[
                              drift?.hours_stale ? 'Horómetro sin actualizar +30d' : '',
                              drift?.km_stale ? 'Odómetro sin actualizar +30d' : '',
                            ].filter(Boolean).join(' · ')}
                            className="inline-flex items-center"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        )}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {kpis}
        <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center lg:justify-between pt-4 border-t">
          <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="break-words">
              {compositeContext.composite && compositeContext.components.length > 0
                ? (() => {
                    const names = Array.from(
                      new Set(
                        compositeContext.components.map((c: any) => c?.plants?.name).filter(Boolean)
                      )
                    )
                    return names.length === 1 ? names[0] : "Varios"
                  })()
                : (asset as any)?.plants?.name || asset?.location || "Sin planta"}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 flex-shrink-0" />
            <span className="break-words">
              {compositeContext.composite && compositeContext.components.length > 0
                ? (() => {
                    const names = Array.from(
                      new Set(
                        compositeContext.components
                          .map((c: any) => c?.departments?.name)
                          .filter(Boolean)
                      )
                    )
                    return names.length === 1 ? names[0] : "Varios"
                  })()
                : (asset as any)?.departments?.name || asset?.department || "Sin departamento"}
            </span>
          </span>
          {asset.purchase_date && (
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span className="break-words">
                Compra: {formatDate(asset.purchase_date)}
              </span>
            </span>
          )}
          </div>
          {actions && (
            <div className="flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
