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
  /** When true, hides the per-row stage badge */
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

/** Map raw workflowStage label from API to a compact display label + Tailwind color classes */
function getStageMeta(stageLabel: string): { short: string; color: string } | null {
  const lc = stageLabel.toLowerCase()
  if (lc.includes("técnica") || lc.includes("tecnica")) {
    return { short: "Val. técnica", color: "bg-sky-50 text-sky-700 border border-sky-200" }
  }
  if (lc.includes("viabilidad")) {
    return { short: "Viabilidad", color: "bg-amber-50 text-amber-700 border border-amber-200" }
  }
  if (lc.includes("final")) {
    return { short: "Aprob. final", color: "bg-red-50 text-red-700 border border-red-200" }
  }
  if (stageLabel) {
    return { short: stageLabel, color: "bg-muted text-muted-foreground" }
  }
  return null
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
  const STAGE_DISPLAY: Record<NonNullable<ApprovalStage>, string> = {
    technical: "Val. técnica",
    viability: "Viabilidad",
    final: "Aprob. final",
  }
  const sectionTitle =
    title ?? (myStage ? `Pendientes — ${STAGE_DISPLAY[myStage]}` : "Cola de aprobación")

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{sectionTitle}</span>
          {!isLoading && totalCount > 0 && (
            <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-background tabular-num min-w-[22px]">
              {totalCount}
            </span>
          )}
        </div>
        {totalCount > 0 && !isLoading && (
          <Link
            href={viewAllHref}
            className="shrink-0 ml-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver todas →
          </Link>
        )}
      </div>

      {/* ── Rows ─────────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="divide-y divide-border/40">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse sm:px-5">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-muted/60" />
                <div className="h-2.5 w-40 rounded bg-muted/40" />
              </div>
              <div className="h-4 w-20 rounded bg-muted/60 tabular-num" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5 sm:px-5">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-muted-foreground">Sin pendientes · Todo al día</span>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {items.map((po, idx) => {
            const ctx = approvalContext[po.id]
            const age = formatAge(po.created_at)
            const supplier = (po.supplier ?? (po as any).items_preview ?? "—") as string
            // workflowStage from the API is the human-readable display label
            const stageMeta = !hideStageLabel ? getStageMeta(ctx?.workflowStage ?? "") : null

            return (
              <Link
                key={po.id}
                href={`/compras?highlight=${po.id}`}
                className={cn(
                  "group grid items-center gap-x-3 px-4 transition-colors hover:bg-muted/40 active:bg-muted/60 sm:px-5",
                  // Mobile: 2-col (info | amount+chevron)
                  // Desktop: 3-col (num | info | amount+chevron)
                  "grid-cols-[1fr_auto] sm:grid-cols-[1.5rem_1fr_auto]",
                  "min-h-[60px] py-3"
                )}
              >
                {/* Row number — desktop only */}
                <span className="hidden sm:block text-center text-xs font-medium text-muted-foreground/40 tabular-num">
                  {idx + 1}
                </span>

                {/* ── Order info (fills available width) ─── */}
                <div className="min-w-0">
                  {/* Line 1: order_id + age + stage badge */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold tabular-num">{po.order_id}</span>

                    {age && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {age}
                      </span>
                    )}

                    {stageMeta && (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                          stageMeta.color
                        )}
                      >
                        {stageMeta.short}
                      </span>
                    )}
                  </div>

                  {/* Line 2: supplier */}
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{supplier}</p>
                </div>

                {/* ── Amount + chevron ─── */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="tabular-num text-sm font-semibold sm:text-base">
                    {formatAmount(po.total_amount)}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Footer overflow indicator ──────────────────────────────────────── */}
      {!isLoading && totalCount > items.length && (
        <div className="border-t border-border/40 bg-muted/20 px-4 py-3 sm:px-5">
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
