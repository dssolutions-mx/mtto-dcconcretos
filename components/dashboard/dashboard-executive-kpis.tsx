"use client"

import Link from "next/link"
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Wrench, ClipboardList, DollarSign, BarChart3 } from "lucide-react"
import { useExecutiveKPIs } from "@/hooks/useExecutiveKPIs"
import { cn } from "@/lib/utils"
import type { ExecutiveKPIs } from "@/app/api/dashboard/executive-kpis/route"

/** GERENCIA_GENERAL = strategic (cost, link to report). GERENTE_MANTENIMIENTO / AREA_ADMINISTRATIVA = operational KPIs. */
export type ExecutiveKpiRole = "GERENCIA_GENERAL" | "GERENTE_MANTENIMIENTO" | "AREA_ADMINISTRATIVA"

/** KPI card: value + label + optional trend */
function KpiCard({
  label,
  value,
  sublabel,
  trend,
  href,
  icon: Icon,
}: {
  label: string
  value: string | number
  sublabel?: string
  trend?: "up" | "down" | "neutral"
  href?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  const content = (
    <div className="flex items-start gap-4 rounded-xl border border-border/50 bg-card px-6 py-4">
      {Icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {(sublabel || trend) && (
          <div className="mt-1 flex items-center gap-2">
            {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
            {trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-green-600" />}
            {trend === "down" && <TrendingDown className="h-3.5 w-3.5 text-amber-600" />}
          </div>
        )}
      </div>
    </div>
  )
  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-90">
        {content}
      </Link>
    )
  }
  return content
}

/** Work order status bar */
function WorkOrderBar({
  pending,
  completed,
  href = "/ordenes",
}: {
  pending: number
  completed: number
  href?: string
}) {
  const total = pending + completed
  const pendingPct = total > 0 ? (pending / total) * 100 : 0
  return (
    <Link
      href={href}
      className="block rounded-xl border border-border/50 bg-card px-6 py-4 transition-opacity hover:opacity-90"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
            <Wrench className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Órdenes de trabajo</p>
            <p className="text-lg font-semibold tabular-nums">
              {pending} pendientes · {completed} completadas
            </p>
          </div>
        </div>
      </div>
      {total > 0 && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-amber-500/70 transition-all"
            style={{ width: `${Math.min(pendingPct, 100)}%` }}
          />
        </div>
      )}
    </Link>
  )
}

/** Checklist compliance with target */
function ComplianceCard({
  rate,
  due,
  completed,
  href = "/checklists",
}: {
  rate: number
  due: number
  completed: number
  href?: string
}) {
  const isGood = rate >= 90
  const isWarning = rate >= 70 && rate < 90
  return (
    <Link
      href={href}
      className="block rounded-xl border border-border/50 bg-card px-6 py-4 transition-opacity hover:opacity-90"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Cumplimiento checklists</p>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                isGood && "text-green-600",
                isWarning && "text-amber-600",
                !isGood && !isWarning && "text-red-600"
              )}
            >
              {rate}%
            </p>
            <p className="text-xs text-muted-foreground">
              {completed} de {due} realizados (30 días)
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

/** Critical alerts list */
function CriticalAlertsList({
  alerts,
}: {
  alerts: Array<{ type: string; count: number; label: string; href: string; severity: string }>
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card">
      <div className="flex items-center gap-2 border-b border-border/50 px-6 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium">
          {alerts.length > 0 ? "Atención requerida" : "Estado"}
        </span>
      </div>
      <div className="divide-y divide-border/40">
        {alerts.length === 0 ? (
          <div className="px-6 py-4 text-sm text-muted-foreground">
            No hay alertas críticas
          </div>
        ) : (
          alerts.map((a) => (
            <Link
              key={a.type}
              href={a.href}
              className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-muted/30"
            >
              <span className="text-sm">
                <span className="font-medium tabular-nums">{a.count}</span>{" "}
                <span className="text-muted-foreground">{a.label}</span>
              </span>
              <span className="text-xs text-muted-foreground">Ver →</span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

/** Backlog aging breakdown */
function BacklogAgingCard({ aging, href = "/ordenes" }: { aging: ExecutiveKPIs["backlogAging"]; href?: string }) {
  const total = aging["0-7"] + aging["8-14"] + aging["15-30"] + aging["31+"]
  return (
    <Link
      href={href}
      className="block rounded-xl border border-border/50 bg-card px-6 py-4 transition-opacity hover:opacity-90"
    >
      <p className="text-sm font-medium text-muted-foreground">Backlog por antigüedad</p>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sin backlog abierto</p>
      ) : (
      <div className="mt-2 flex gap-2">
        <div
          className="flex-1 rounded-lg bg-muted/40 px-2 py-1.5 text-center"
          title="0-7 días"
        >
          <span className="text-lg font-semibold tabular-nums">{aging["0-7"]}</span>
          <span className="ml-1 text-xs text-muted-foreground">0-7d</span>
        </div>
        <div
          className="flex-1 rounded-lg bg-muted/40 px-2 py-1.5 text-center"
          title="8-14 días"
        >
          <span className="text-lg font-semibold tabular-nums">{aging["8-14"]}</span>
          <span className="ml-1 text-xs text-muted-foreground">8-14d</span>
        </div>
        <div
          className="flex-1 rounded-lg bg-muted/40 px-2 py-1.5 text-center"
          title="15-30 días"
        >
          <span className="text-lg font-semibold tabular-nums">{aging["15-30"]}</span>
          <span className="ml-1 text-xs text-muted-foreground">15-30d</span>
        </div>
        <div
          className={cn(
            "flex-1 rounded-lg px-2 py-1.5 text-center",
            aging["31+"] > 0 ? "bg-amber-500/20" : "bg-muted/40"
          )}
          title="31+ días"
        >
          <span className="text-lg font-semibold tabular-nums">{aging["31+"]}</span>
          <span className="ml-1 text-xs text-muted-foreground">31+d</span>
        </div>
      </div>
      )}
    </Link>
  )
}

/** Planned vs reactive ratio */
function PlannedReactiveCard({
  planned,
  reactive,
  ratio,
}: {
  planned: number
  reactive: number
  ratio: number
}) {
  const total = planned + reactive
  const isGood = total > 0 && ratio >= 70
  const isWarning = total > 0 && ratio < 70
  return (
    <div className="rounded-xl border border-border/50 bg-card px-6 py-4">
      <p className="text-sm font-medium text-muted-foreground">Planificado vs correctivo</p>
      <p
        className={cn(
          "mt-0.5 text-2xl font-semibold tabular-nums",
          isGood && "text-green-600",
          isWarning && "text-amber-600"
        )}
      >
        {total > 0 ? `${ratio}% planificado` : "—"}
      </p>
      <p className="text-xs text-muted-foreground">
        {total > 0 ? `${planned} preventivas · ${reactive} correctivas` : "Sin órdenes completadas"}
      </p>
    </div>
  )
}

/** Gerencia General: strategic overview only (cost, link to full report). No operational KPIs. */
function GMSummaryView({ data }: { data: ExecutiveKPIs }) {
  const costTrend =
    data.maintenanceCost.lastMonth != null && data.maintenanceCost.lastMonth > 0
      ? data.maintenanceCost.thisMonth > data.maintenanceCost.lastMonth
        ? "up"
        : data.maintenanceCost.thisMonth < data.maintenanceCost.lastMonth
          ? "down"
          : "neutral"
      : undefined

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        label="Costo mantenimiento (este mes)"
        value={`$${data.maintenanceCost.thisMonth.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
        sublabel={
          data.maintenanceCost.lastMonth != null
            ? `vs $${data.maintenanceCost.lastMonth.toLocaleString("es-MX", { maximumFractionDigits: 0 })} mes ant.`
            : undefined
        }
        trend={costTrend}
        icon={DollarSign}
      />
      <Link
        href="/reportes/gerencial"
        className="flex items-start gap-4 rounded-xl border border-border/50 bg-card px-6 py-4 transition-opacity hover:opacity-90"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Reporte gerencial completo</p>
          <p className="mt-0.5 text-base font-medium">Ventas, diesel, mantenimiento, EBITDA</p>
          <p className="mt-1 text-xs text-muted-foreground">Ver análisis →</p>
        </div>
      </Link>
    </div>
  )
}

/** Gerente de Mantenimiento / Administración: full operational KPIs. */
function OperationalSummaryView({ data }: { data: ExecutiveKPIs }) {
  const costTrend =
    data.maintenanceCost.lastMonth != null && data.maintenanceCost.lastMonth > 0
      ? data.maintenanceCost.thisMonth > data.maintenanceCost.lastMonth
        ? "up"
        : data.maintenanceCost.thisMonth < data.maintenanceCost.lastMonth
          ? "down"
          : "neutral"
      : undefined

  return (
    <div className="space-y-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Resumen operativo
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Costo mantenimiento (este mes)"
          value={`$${data.maintenanceCost.thisMonth.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
          sublabel={
            data.maintenanceCost.lastMonth != null
              ? `vs $${data.maintenanceCost.lastMonth.toLocaleString("es-MX", { maximumFractionDigits: 0 })} mes ant.`
              : undefined
          }
          trend={costTrend}
          icon={DollarSign}
        />
        <div className="sm:col-span-2">
          <WorkOrderBar
            pending={data.workOrders.pending}
            completed={data.workOrders.completed}
          />
        </div>
        <ComplianceCard
          rate={data.checklistCompliance.rate}
          due={data.checklistCompliance.due}
          completed={data.checklistCompliance.completed}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CriticalAlertsList alerts={data.criticalAlerts} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <BacklogAgingCard aging={data.backlogAging} />
          <PlannedReactiveCard
            planned={data.plannedVsReactive.planned}
            reactive={data.plannedVsReactive.reactive}
            ratio={data.plannedVsReactive.ratio}
          />
        </div>
      </div>
    </div>
  )
}

export function DashboardExecutiveKPIs({ role }: { role: ExecutiveKpiRole }) {
  const { data, loading } = useExecutiveKPIs()

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border/50 bg-card py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) return null

  if (role === "GERENCIA_GENERAL") {
    return (
      <>
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Resumen estratégico
        </p>
        <GMSummaryView data={data} />
      </>
    )
  }

  return <OperationalSummaryView data={data} />
}
