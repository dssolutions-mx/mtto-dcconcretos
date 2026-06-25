"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, Clock, Save, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDraftSavedAt } from "@/lib/checklist/schedule-draft-display"
import type { PlantControlDueSummary } from "@/types/plant-operations-schedule"

type Props = {
  due: PlantControlDueSummary | null | undefined
  loading?: boolean
}

const STATUS_LABEL: Record<PlantControlDueSummary["dueStatus"], string> = {
  on_time: "Al día",
  due_today: "Vence hoy",
  overdue: "Vencido",
}

export function PlantControlDueCard({ due, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-4">
        <div className="h-5 w-40 animate-pulse rounded bg-muted/60" />
        <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted/40" />
      </div>
    )
  }

  if (!due) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-5">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Shield className="h-4 w-4" />
          Control de planta
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Sin programación de control de planta para hoy.
        </p>
      </div>
    )
  }

  const isUrgent = due.dueStatus === "due_today" || due.dueStatus === "overdue"
  const StatusIcon =
    due.dueStatus === "on_time"
      ? CheckCircle2
      : due.dueStatus === "due_today"
        ? Clock
        : AlertTriangle

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-4 sm:px-5",
        isUrgent
          ? "border-amber-300/80 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30"
          : "border-border/50 bg-card"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-semibold">Control de planta</span>
            <span className="rounded-full border border-sky-300/60 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
              Operaciones de planta
            </span>
          </div>
          {due.checklistName ? (
            <p className="text-sm text-muted-foreground truncate">{due.checklistName}</p>
          ) : null}
          <div className="flex items-center gap-2 text-sm">
            <StatusIcon
              className={cn(
                "h-4 w-4 shrink-0",
                due.dueStatus === "on_time" && "text-green-600",
                due.dueStatus === "due_today" && "text-amber-600",
                due.dueStatus === "overdue" && "text-destructive"
              )}
            />
            <span className="font-medium">{STATUS_LABEL[due.dueStatus]}</span>
            {due.scheduledDay ? (
              <span className="text-muted-foreground">· {due.scheduledDay}</span>
            ) : null}
          </div>
          {due.monthlyClosureDaysRemaining != null ? (
            <p className="text-xs text-muted-foreground">
              Cierre mensual:{" "}
              {due.monthlyClosureDaysRemaining > 0
                ? `faltan ${due.monthlyClosureDaysRemaining} día(s)`
                : due.monthlyClosureDaysRemaining === 0
                  ? "vence hoy"
                  : `vencido hace ${Math.abs(due.monthlyClosureDaysRemaining)} día(s)`}
            </p>
          ) : null}
          {due.hasDraft ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge
                variant="outline"
                className="gap-1 border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
              >
                <Save className="h-3 w-3" />
                Borrador
                {due.draftUpdatedAt
                  ? ` · ${formatDraftSavedAt(due.draftUpdatedAt)}`
                  : ""}
              </Badge>
              {due.bonusClosureDraftDecisions != null &&
              due.bonusClosureDraftDecisions > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {due.bonusClosureDraftDecisions} operador(es) con decisión guardada
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {due.scheduleId && isUrgent ? (
          <Button size="sm" className="shrink-0" asChild>
            <Link href={`/checklists/ejecutar/${due.scheduleId}`}>Completar</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
