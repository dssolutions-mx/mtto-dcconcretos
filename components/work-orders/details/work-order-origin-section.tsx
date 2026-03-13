"use client"

import { Badge } from "@/components/ui/badge"
import { ClipboardCheck, Calendar } from "lucide-react"
import { MaintenanceType } from "@/types"
import type { OriginType, WorkOrderOriginData } from "@/lib/work-orders/build-origin-data"
import { cn } from "@/lib/utils"

interface WorkOrderOriginSectionProps {
  origin: WorkOrderOriginData
  workOrderType: string | null
  className?: string
}

function getOriginBadgeLabel(originType: OriginType): string {
  switch (originType) {
    case "incident":
      return "Desde incidente"
    case "checklist":
      return "Desde checklist"
    case "preventive":
      return "Preventivo programado"
    case "adhoc":
    default:
      return "Manual / Ad-hoc"
  }
}

function getOriginBadgeVariant(originType: OriginType): "default" | "secondary" | "outline" | "destructive" {
  switch (originType) {
    case "incident":
      return "destructive"
    case "checklist":
      return "secondary"
    case "preventive":
      return "outline"
    case "adhoc":
    default:
      return "outline"
  }
}

export function WorkOrderOriginSection({
  origin,
  workOrderType,
  className,
}: WorkOrderOriginSectionProps) {
  const isPreventive =
    workOrderType === MaintenanceType.Preventive || workOrderType === "Preventivo" || workOrderType === "preventive"

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Origen
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={getOriginBadgeVariant(origin.originType)}>
          {getOriginBadgeLabel(origin.originType)}
        </Badge>
        {origin.originName && (
          <span className="text-sm font-medium">
            {isPreventive ? `Plan: ${origin.originName}` : origin.originName}
          </span>
        )}
        {origin.cycleInterval && isPreventive && (
          <Badge variant="outline" className="text-xs">
            {origin.cycleInterval}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
        <span className="text-muted-foreground">{origin.fechaLabel}:</span>
        <span className="font-medium">{origin.fechaValue ?? "N/A"}</span>
      </div>
    </section>
  )
}
