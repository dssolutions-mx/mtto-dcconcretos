"use client"

import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { History } from "lucide-react"
import { normalizeIssueCoreItem } from "@/lib/incidents/normalize-issue-core-item"
import { cn } from "@/lib/utils"

export type IncidentThreadHistoryItem = {
  id: string
  description?: string | null
  status?: string | null
  date?: string | null
  created_at?: string | null
  work_order_id?: string | null
  work_order_order_id?: string | null
}

type IncidentThreadHistoryProps = {
  items: IncidentThreadHistoryItem[]
  currentIncidentId?: string
  highlightWorkOrderId?: string
  coreItemLabel?: string
  className?: string
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return format(new Date(value), "d MMM yyyy", { locale: es })
  } catch {
    return "—"
  }
}

function statusTone(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase()
  if (s.includes("resuel") || s.includes("cerr")) {
    return "border-green-200 bg-green-50 text-green-800"
  }
  if (s.includes("progreso")) {
    return "border-sky-200 bg-sky-50 text-sky-800"
  }
  return "border-amber-200 bg-amber-50 text-amber-900"
}

export function IncidentThreadHistory({
  items,
  currentIncidentId,
  highlightWorkOrderId,
  coreItemLabel,
  className,
}: IncidentThreadHistoryProps) {
  if (items.length <= 1) return null

  const label =
    coreItemLabel ??
    (normalizeIssueCoreItem(items[0]?.description ?? "") || "Ítem de checklist")

  const sorted = [...items].sort((a, b) => {
    const ta = new Date(String(a.date ?? a.created_at ?? "")).getTime()
    const tb = new Date(String(b.date ?? b.created_at ?? "")).getTime()
    return tb - ta
  })

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden />
          Historial del mismo problema
        </CardTitle>
        <CardDescription className="text-xs">
          {label} · {items.length} registros en este activo (reapariciones del mismo ítem de
          checklist)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((row) => {
          const isCurrent =
            row.id === currentIncidentId ||
            (!!highlightWorkOrderId && row.work_order_id === highlightWorkOrderId)
          return (
            <div
              key={row.id}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                isCurrent ? "border-primary/40 bg-primary/5" : "border-border/60",
              )}
            >
              <div className="flex flex-wrap items-center gap-2 justify-between gap-y-1">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground shrink-0">
                    Obs: {formatShortDate(row.date ?? row.created_at)}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    Reg: {formatShortDate(row.created_at)}
                  </span>
                  {row.status && (
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] h-5", statusTone(row.status))}
                    >
                      {row.status}
                    </Badge>
                  )}
                  {isCurrent && (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      Actual
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isCurrent && (
                    <Link
                      href={`/incidentes/${row.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Ver incidente
                    </Link>
                  )}
                  {row.work_order_id && (
                    <Link
                      href={`/ordenes/${row.work_order_id}`}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {row.work_order_order_id
                        ? `OT #${row.work_order_order_id}`
                        : "Ver OT"}
                    </Link>
                  )}
                </div>
              </div>
              {row.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {row.description}
                </p>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
