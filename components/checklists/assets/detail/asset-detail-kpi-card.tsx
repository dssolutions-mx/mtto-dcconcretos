"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { MapPin, Users, Truck } from "lucide-react"

interface Asset {
  id: string
  name: string
  asset_id: string
  location: string | null
  department: string | null
  plants?: { name: string } | null
  departments?: { name: string } | null
}

interface AssetDetailKpiCardProps {
  totalPending: number
  overdue: number
  today: number
  recentCompleted: number
  asset: Asset
}

export function AssetDetailKpiCard({
  totalPending,
  overdue,
  today,
  recentCompleted,
  asset,
}: AssetDetailKpiCardProps) {
  const plantName = asset.plants?.name || asset.location || "Sin planta"
  const departmentName =
    asset.departments?.name || asset.department || "Sin departamento"

  return (
    <Card className="mb-6 border-slate-200 dark:border-slate-700 shadow-checklist-2 bg-slate-50/50 dark:bg-slate-900/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-checklist-primary font-sans">
          <Truck className="h-6 w-6 text-checklist-primary" />
          Información del Activo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-checklist-primary">
              {totalPending}
            </div>
            <div className="text-sm text-muted-foreground">Checklists Pendientes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-checklist-status-overdue">
              {overdue}
            </div>
            <div className="text-sm text-muted-foreground">Atrasados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-checklist-status-due">
              {today}
            </div>
            <div className="text-sm text-muted-foreground">Para Hoy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-checklist-status-ok">
              {recentCompleted}
            </div>
            <div className="text-sm text-muted-foreground">Completados Recientes</div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium">ID:</span>
            <span className="font-mono">{asset.asset_id}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium">Planta:</span>
            <span>{plantName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium">Departamento:</span>
            <span>{departmentName}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
