"use client"

import { memo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Check, Eye, XCircle } from "lucide-react"
import Link from "next/link"

interface CompletedItem {
  id: string
  item_id: string
  status: "pass" | "flag" | "fail"
  notes?: string
  photo_url?: string
}

interface CompletedChecklist {
  id: string
  template_id: string
  asset_id: string
  scheduled_date: string
  status: string
  assigned_to: string | null
  updated_at: string
  completion_date?: string
  technician?: string
  completed_items?: CompletedItem[]
  checklists: {
    id: string
    name: string
    frequency: string
  } | null
  profiles: {
    nombre: string | null
    apellido: string | null
  } | null
}

interface CompletedChecklistCardProps {
  checklist: CompletedChecklist
  formatRelativeDate: (dateString: string) => string
  assetId: string
}

function getCompletedChecklistSummary(checklist: CompletedChecklist) {
  if (!checklist.completed_items) {
    return { total: 0, passed: 0, flagged: 0, failed: 0 }
  }
  const items = checklist.completed_items
  return {
    total: items.length,
    passed: items.filter((item) => item.status === "pass").length,
    flagged: items.filter((item) => item.status === "flag").length,
    failed: items.filter((item) => item.status === "fail").length,
  }
}

function getCompletedChecklistBadge(checklist: CompletedChecklist) {
  const summary = getCompletedChecklistSummary(checklist)

  if (summary.total === 0) {
    return (
      <Badge className="bg-checklist-status-ok hover:bg-checklist-status-ok/90 text-white flex items-center gap-1 flex-shrink-0 cursor-default">
        <Check className="h-3 w-3" />
        Completado
      </Badge>
    )
  }

  if (summary.failed > 0) {
    return (
      <Badge
        variant="destructive"
        className="flex items-center gap-1 flex-shrink-0 cursor-default"
      >
        <XCircle className="h-3 w-3" />
        {summary.failed} Fallidos
      </Badge>
    )
  }
  if (summary.flagged > 0) {
    return (
      <Badge
        className="bg-checklist-status-due hover:bg-checklist-status-due/90 text-white flex items-center gap-1 flex-shrink-0 cursor-default"
      >
        <AlertTriangle className="h-3 w-3" />
        {summary.flagged} Con Atención
      </Badge>
    )
  }
  return (
    <Badge className="bg-checklist-status-ok hover:bg-checklist-status-ok/90 text-white flex items-center gap-1 flex-shrink-0 cursor-default">
      <Check className="h-3 w-3" />
      Todo Correcto
    </Badge>
  )
}

function CompletedChecklistCardInner({
  checklist,
  formatRelativeDate,
  assetId,
}: CompletedChecklistCardProps) {
  const summary = getCompletedChecklistSummary(checklist)
  const technicianName = checklist.technician
    ? checklist.technician
    : checklist.profiles
      ? `${checklist.profiles.nombre} ${checklist.profiles.apellido}`
      : "Usuario desconocido"
  const checklistName = checklist.checklists?.name || "Sin nombre"

  return (
    <div className="border-l-4 border-checklist-status-ok pl-4 py-3 bg-background dark:bg-card rounded transition-colors duration-200 hover:bg-muted/30 cursor-default">
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-green-800 dark:text-green-200">
            {checklistName}
          </h4>
          <p className="text-sm text-green-600 dark:text-green-300 font-medium">
            Completado{" "}
            {formatRelativeDate(checklist.completion_date || checklist.updated_at)}
          </p>
          <p className="text-xs text-muted-foreground">
            Por: {technicianName}
          </p>
          {summary.total > 0 && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {summary.total} items:
              </span>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                {summary.passed}
                <Check className="h-3 w-3 text-checklist-status-ok" />
              </span>
              {summary.flagged > 0 && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  , {summary.flagged}
                  <AlertTriangle className="h-3 w-3 text-checklist-status-due" />
                </span>
              )}
              {summary.failed > 0 && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  , {summary.failed}
                  <XCircle className="h-3 w-3 text-destructive" />
                </span>
              )}
            </div>
          )}
        </div>
        {getCompletedChecklistBadge(checklist)}
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link
            href={`/checklists/completado/${checklist.id}`}
            className="cursor-pointer transition-colors duration-200"
          >
            <Eye className="h-3 w-3 mr-1" />
            Ver Detalles
          </Link>
        </Button>
      </div>
    </div>
  )
}

export const CompletedChecklistCard = memo(CompletedChecklistCardInner)
