"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, ChevronRight, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PlantDailyReadinessPayload } from "@/types/plant-daily-readiness"

type Props = {
  loading: boolean
  payload: PlantDailyReadinessPayload | null
  /** Right-side hint in the table header (e.g. dosificador operational rule). */
  headerCaption?: string | null
  /** When rows are empty, optional extra line under the default message. */
  emptyExtra?: ReactNode
}

export function PlantDailyReadinessTable({
  loading,
  payload,
  headerCaption = "No cargar unidad si la inspección diaria no está completada.",
  emptyExtra,
}: Props) {
  const rows = payload?.rows ?? []

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
        <div className="border-b border-border/50 px-4 py-3 sm:px-5">
          <div className="h-4 w-48 animate-pulse rounded bg-muted/60" />
        </div>
        <div className="divide-y divide-border/40">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4 px-4 py-4 sm:px-5">
              <div className="h-10 flex-1 animate-pulse rounded bg-muted/50" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card px-4 py-6 sm:px-5">
        <p className="text-sm text-muted-foreground">
          No hay programaciones de checklist <strong>diario</strong> para hoy en tu planta, o aún no hay
          activos operativos con inspección diaria pendiente o vencida registrada.
        </p>
        {payload?.todayKey && (
          <p className="mt-2 text-xs text-muted-foreground/80">Fecha (UTC): {payload.todayKey}</p>
        )}
        {emptyExtra}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 min-w-0">
          <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold truncate">Activos · inspección diaria</span>
          <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-background tabular-num min-w-[22px]">
            {rows.length}
          </span>
        </div>
        {headerCaption ? (
          <p className="text-[10px] text-muted-foreground sm:text-xs max-w-[min(100%,28rem)] text-right">
            {headerCaption}
          </p>
        ) : null}
      </div>

      <div className="divide-y divide-border/40">
        {rows.map((row, idx) => {
          const ok = row.readiness === "listo"
          return (
            <div
              key={row.assetId}
              className={cn(
                "grid gap-3 px-4 py-3 sm:px-5 sm:grid-cols-[auto_1fr_auto] sm:items-center",
                !ok && "bg-amber-50/50 dark:bg-amber-950/15"
              )}
            >
              <span className="hidden sm:block text-center text-xs font-medium text-muted-foreground/40 tabular-num">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold tabular-nums">{row.assetCode ?? "—"}</p>
                  {ok ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      Listo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                      <AlertTriangle className="h-3 w-3" />
                      Pendiente
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.assetName ?? "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">Operador:</span>{" "}
                  {row.operatorName ?? "Sin asignar"}
                </p>
                {row.checklistName && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground/90">{row.checklistName}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2">
                {!ok && row.pendingScheduleId ? (
                  <Button asChild size="sm" variant="secondary" className="min-h-[40px]">
                    <Link href={`/checklists/ejecutar/${row.pendingScheduleId}`}>
                      Ejecutar
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline" className="min-h-[40px]">
                    <Link href={`/checklists/assets/${row.assetId}`}>
                      Ver
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
