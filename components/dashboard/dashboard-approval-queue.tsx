"use client"

import Link from "next/link"
import { CheckCircle2, ChevronRight, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PurchaseOrderWithWorkOrder } from "@/components/compras/useComprasData"
import type { ApprovalContextItem } from "@/types/purchase-orders"
import type { ApprovalStage } from "@/hooks/useDashboardApprovalQueue"

interface DashboardApprovalQueueProps {
  items: PurchaseOrderWithWorkOrder[]
  approvalContext: Record<string, ApprovalContextItem>
  totalCount: number
  isLoading: boolean
  myStage: ApprovalStage
  viewAllHref: string
  title?: string
  /** When true, hides the per-row stage badge (e.g. for GG where it's noise) */
  hideStageLabel?: boolean
}


function formatAge(createdAt: string | null | undefined): string {
  if (!createdAt) return ""
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  if (days === 0) return "hoy"
  if (days === 1) return "1d"
  return `${days}d`
}

function formatAmount(amount: string | number | null | undefined): string {
  const n = Number(amount ?? 0)
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  })
}

export function DashboardApprovalQueue({
  items,
  approvalContext,
  totalCount,
  isLoading,
  myStage,
  viewAllHref,
  title,
  hideStageLabel = false,
}: DashboardApprovalQueueProps) {
  const sectionTitle =
    title ?? (myStage ? `Pendientes — ${STAGE_LABELS[myStage]}` : "Cola de aprobación")

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold">{sectionTitle}</span>
          {!isLoading && totalCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-background tabular-num min-w-[22px]">
              {totalCount}
            </span>
          )}
        </div>
        {totalCount > 0 && !isLoading && (
          <Link
            href={viewAllHref}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver todas →
          </Link>
        )}
      </div>

      {/* Rows */}
      {isLoading ? (
        /* Skeleton */
        <div className="divide-y divide-border/40">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-muted/60" />
                <div className="h-2.5 w-40 rounded bg-muted/40" />
              </div>
              <div className="h-4 w-20 rounded bg-muted/60 tabular-num" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-5">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-muted-foreground">Sin pendientes · Todo al día</span>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {items.map((po, idx) => {
            const ctx = approvalContext[po.id]
            const age = formatAge(po.created_at)
            const supplier = (po.supplier ?? (po as any).items_preview ?? "—") as string
            // workflowStage from the API is already a human-readable label
            const stageLabel = ctx?.workflowStage ?? ""
            const stageBadgeColor = stageLabel.toLowerCase().includes("técnica")
              ? "bg-blue-50 text-blue-700"
              : stageLabel.toLowerCase().includes("viabilidad")
              ? "bg-amber-50 text-amber-700"
              : stageLabel.toLowerCase().includes("final")
              ? "bg-red-50 text-red-700"
              : "bg-muted text-muted-foreground"

            return (
              <Link
                key={po.id}
                href={`/compras?highlight=${po.id}`}
                className={cn(
                  "group flex items-center gap-4 px-5 transition-colors hover:bg-muted/40 active:bg-muted/60",
                  "min-h-[56px] py-3"
                )}
              >
                {/* Row number — subtle visual anchor */}
                <span className="hidden sm:block w-5 shrink-0 text-center text-xs font-medium text-muted-foreground/40 tabular-num">
                  {idx + 1}
                </span>

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold tabular-num">{po.order_id}</span>
                    {age && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {age}
                      </span>
                    )}
                    {!hideStageLabel && stageLabel && (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          stageBadgeColor
                        )}
                      >
                        {stageLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-[240px]">
                    {supplier}
                  </p>
                </div>

                {/* Amount — the hero of each row */}
                <span className="tabular-num text-base font-semibold shrink-0 text-right">
                  {formatAmount(po.total_amount)}
                </span>

                <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )
          })}
        </div>
      )}

      {/* Footer overflow indicator */}
      {!isLoading && totalCount > items.length && (
        <div className="border-t border-border/40 bg-muted/20 px-5 py-3">
          <Link
            href={viewAllHref}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            + {totalCount - items.length} órdenes más pendientes →
          </Link>
        </div>
      )}
    </div>
  )
}
