"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Users, Play, AlertTriangle, CheckCircle, Clock, Calendar } from "lucide-react"
import Link from "next/link"

export type ChecklistStatus = "ok" | "due_soon" | "overdue" | "no_schedule"

export interface AssetChecklistCardData {
  id: string
  name: string
  asset_id: string
  location: string | null
  department: string | null
  pending_checklists: number
  overdue_checklists: number
  next_checklist_date: string | null
  last_checklist_date: string | null
  checklist_status: ChecklistStatus
  plants?: { name: string } | null
  departments?: { name: string } | null
  equipment_models?: { id: string; name: string; manufacturer?: string | null } | null
}

interface AssetChecklistCardProps {
  asset: AssetChecklistCardData
  formatDate: (date: string | null) => string | null
}

function getStatusBadge(status: ChecklistStatus) {
  switch (status) {
    case "overdue":
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Atrasado
        </Badge>
      )
    case "due_soon":
      return (
        <Badge className="bg-checklist-status-due hover:bg-checklist-status-due/90 text-white flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Próximo
        </Badge>
      )
    case "ok":
      return (
        <Badge className="bg-checklist-status-ok hover:bg-checklist-status-ok/90 text-white flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Al día
        </Badge>
      )
    case "no_schedule":
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Sin programar
        </Badge>
      )
  }
}

function getStatusCardClasses(status: ChecklistStatus) {
  switch (status) {
    case "overdue":
      return "border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20"
    case "due_soon":
      return "border-yellow-300 dark:border-yellow-900/50 bg-yellow-50/50 dark:bg-yellow-950/20"
    case "ok":
      return "border-green-300 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20"
    case "no_schedule":
      return "border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/20"
  }
}

export function AssetChecklistCard({ asset, formatDate }: AssetChecklistCardProps) {
  const plantName = asset.plants?.name || asset.location || "Sin planta"
  const departmentName = asset.departments?.name || asset.department || "Sin departamento"
  const modelName = asset.equipment_models?.name || asset.name

  return (
    <Link
      href={`/checklists/assets/${asset.id}`}
      className="block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg transition-colors duration-200"
    >
      <Card
        className={`shadow-checklist-1 hover:shadow-checklist-2 transition-all duration-200 cursor-pointer ${getStatusCardClasses(
          asset.checklist_status
        )}`}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold truncate font-mono tabular-nums">{asset.asset_id}</h3>
              <p className="text-sm text-muted-foreground">
                Modelo: {modelName}
              </p>
            </div>
            {getStatusBadge(asset.checklist_status)}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{plantName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{departmentName}</span>
          </div>
          {asset.pending_checklists > 0 && (
            <div className="flex items-center justify-between p-2 bg-background rounded-md border">
              <span className="text-sm font-medium">
                {asset.overdue_checklists > 0
                  ? `${asset.overdue_checklists} atrasados`
                  : `${asset.pending_checklists} pendientes`}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                <Play className="h-3 w-3" />
                Ejecutar
              </span>
            </div>
          )}
          {asset.next_checklist_date && (
            <div className="text-xs text-muted-foreground">Próximo: {formatDate(asset.next_checklist_date)}</div>
          )}
          {asset.last_checklist_date && (
            <div className="text-xs text-muted-foreground">Último: {formatDate(asset.last_checklist_date)}</div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
