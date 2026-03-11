"use client"

import { Clock, CheckCircle, Package, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SummaryMetrics {
  pending: number
  approved: number
  validated: number
  adjustments: number
  totalPendingValue: number
  totalMonthValue: number
}

interface ComprasSummaryRibbonProps {
  metrics: SummaryMetrics
  activeTab: string
  onTabChange: (tab: string) => void
  formatCurrency: (amount: number) => string
  hasPending: boolean
}

export function ComprasSummaryRibbon({
  metrics,
  activeTab,
  onTabChange,
  formatCurrency,
  hasPending,
}: ComprasSummaryRibbonProps) {
  const segments = [
    {
      id: "pending",
      label: "Pendientes",
      count: metrics.pending,
      sub: formatCurrency(metrics.totalPendingValue),
      icon: Clock,
      className: hasPending ? "text-yellow-700 hover:bg-yellow-100" : "text-slate-600 hover:bg-slate-100",
      activeClass: "ring-2 ring-yellow-400 ring-offset-2",
    },
    {
      id: "approved",
      label: "Listas",
      count: metrics.approved,
      sub: "Aprobadas",
      icon: CheckCircle,
      className: "text-green-700 hover:bg-green-50",
      activeClass: "ring-2 ring-green-400 ring-offset-2",
    },
    {
      id: "validated",
      label: "En proceso",
      count: metrics.validated,
      sub: "Validadas",
      icon: Package,
      className: "text-slate-600 hover:bg-slate-100",
      activeClass: "ring-2 ring-slate-400 ring-offset-2",
    },
    {
      id: "all",
      label: "Valor del mes",
      count: null,
      sub: formatCurrency(metrics.totalMonthValue),
      icon: TrendingUp,
      className: "text-slate-600 hover:bg-slate-100",
      activeClass: "ring-2 ring-sky-400 ring-offset-2",
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-slate-50/80 px-3 py-2">
      {segments.map((seg) => {
        const Icon = seg.icon
        const isActive = activeTab === seg.id
        return (
          <button
            key={seg.id}
            type="button"
            onClick={() => onTabChange(seg.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer",
              seg.className,
              isActive && seg.activeClass
            )}
            aria-pressed={isActive}
            aria-label={`${seg.label}: ${seg.count ?? seg.sub}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {seg.count != null ? (
              <span className="font-semibold">{seg.count}</span>
            ) : null}
            <span className="text-slate-600">·</span>
            <span className="truncate max-w-[120px]">{seg.sub}</span>
          </button>
        )
      })}
    </div>
  )
}
