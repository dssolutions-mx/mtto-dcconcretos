"use client"

import Link from "next/link"
import { Fuel, Loader2, TrendingDown, TrendingUp, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDashboardMaintenanceCost } from "@/hooks/useDashboardMaintenanceCost"
import { useDashboardApprovalQueue } from "@/hooks/useDashboardApprovalQueue"
import { DashboardApprovalQueue } from "./dashboard-approval-queue"

export type ExecutiveKpiRole = "GERENCIA_GENERAL" | "GERENTE_MANTENIMIENTO" | "AREA_ADMINISTRATIVA"

// ─── Dramatic cost card ───────────────────────────────────────────────────────

function CostCard({
  label,
  value,
  lastMonthValue,
  icon: Icon,
  href,
}: {
  label: string
  value: number
  lastMonthValue?: number | null
  icon: React.ComponentType<{ className?: string }>
  href?: string
}) {
  const formatted = value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  })

  const delta =
    lastMonthValue != null && lastMonthValue > 0 ? value - lastMonthValue : null
  const trend =
    delta === null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "neutral"

  const deltaFormatted =
    delta !== null
      ? Math.abs(delta).toLocaleString("es-MX", {
          style: "currency",
          currency: "MXN",
          maximumFractionDigits: 0,
        })
      : null

  const card = (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-muted/20 px-6 py-5 transition-all hover:border-border hover:bg-muted/30 sm:px-7 sm:py-6 min-h-[140px]">
      {/* Subtle top accent line */}
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-foreground/8" />

      {/* Top row: icon + label */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/80 shadow-sm">
          <Icon className="h-4 w-4 text-foreground/60" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>

      {/* Main value */}
      <div className="mt-4">
        <p className="text-[2.25rem] font-semibold leading-none tracking-tight tabular-num sm:text-[2.75rem]">
          {formatted}
        </p>

        {/* Delta vs last month */}
        {deltaFormatted && trend && trend !== "neutral" ? (
          <div className="mt-2.5 flex items-center gap-1.5">
            {trend === "up" ? (
              <TrendingUp className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-green-600 shrink-0" />
            )}
            <span
              className={cn(
                "text-xs font-medium",
                trend === "up" ? "text-amber-600" : "text-green-700"
              )}
            >
              {trend === "up" ? "+" : "−"}{deltaFormatted} vs mes ant.
            </span>
          </div>
        ) : (
          lastMonthValue == null && (
            <p className="mt-2.5 text-xs text-muted-foreground/60">Sin comparativa anterior</p>
          )
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    )
  }
  return card
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CostCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card px-6 py-5 sm:px-7 sm:py-6 min-h-[130px] animate-pulse">
      <div className="h-3 w-24 rounded bg-muted/60" />
      <div className="mt-6 h-9 w-40 rounded bg-muted/60" />
      <div className="mt-3 h-3 w-32 rounded bg-muted/40" />
    </div>
  )
}

// ─── Gerencia General ─────────────────────────────────────────────────────────

function GMView() {
  const { current, lastMonth, isLoading: costLoading } = useDashboardMaintenanceCost()
  const {
    items,
    approvalContext,
    totalCount,
    isLoading: queueLoading,
    myStage,
  } = useDashboardApprovalQueue()

  return (
    <div className="space-y-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Resumen estratégico
      </p>

      {/* Cost cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {costLoading ? (
          <>
            <CostCardSkeleton />
            <CostCardSkeleton />
          </>
        ) : (
          <>
            <CostCard
              label="Mantenimiento este mes"
              value={current.maintenanceCost}
              lastMonthValue={lastMonth?.maintenanceCost}
              icon={Wrench}
              href="/reportes/gerencial"
            />
            <CostCard
              label="Diésel este mes"
              value={current.dieselCost}
              lastMonthValue={lastMonth?.dieselCost}
              icon={Fuel}
              href="/diesel"
            />
          </>
        )}
      </div>

      {/* Inline approval queue */}
      <DashboardApprovalQueue
        items={items}
        approvalContext={approvalContext}
        totalCount={totalCount}
        isLoading={queueLoading}
        myStage={myStage}
        viewAllHref="/compras?tab=pending"
        title="Órdenes ≥$7k pendientes de aprobación"
      />
    </div>
  )
}

// ─── Operational (GERENTE_MANTENIMIENTO + AREA_ADMINISTRATIVA) ────────────────

function OperationalView({
  role,
}: {
  role: "GERENTE_MANTENIMIENTO" | "AREA_ADMINISTRATIVA"
}) {
  const { current, lastMonth, isLoading: costLoading } = useDashboardMaintenanceCost()
  const {
    items,
    approvalContext,
    totalCount,
    isLoading: queueLoading,
    myStage,
  } = useDashboardApprovalQueue()

  const queueTitle =
    role === "GERENTE_MANTENIMIENTO"
      ? "Órdenes pendientes de validación técnica"
      : "Órdenes pendientes de revisión de viabilidad"

  return (
    <div className="space-y-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Resumen operativo
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {costLoading ? (
          <>
            <CostCardSkeleton />
            <CostCardSkeleton />
          </>
        ) : (
          <>
            <CostCard
              label="Mantenimiento este mes"
              value={current.maintenanceCost}
              lastMonthValue={lastMonth?.maintenanceCost}
              icon={Wrench}
              href="/reportes/gerencial"
            />
            <CostCard
              label="Diésel este mes"
              value={current.dieselCost}
              lastMonthValue={lastMonth?.dieselCost}
              icon={Fuel}
              href="/diesel"
            />
          </>
        )}
      </div>

      <DashboardApprovalQueue
        items={items}
        approvalContext={approvalContext}
        totalCount={totalCount}
        isLoading={queueLoading}
        myStage={myStage}
        viewAllHref="/compras?tab=pending"
        title={queueTitle}
      />
    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function DashboardExecutiveKPIs({ role }: { role: ExecutiveKpiRole }) {
  if (role === "GERENCIA_GENERAL") return <GMView />
  return <OperationalView role={role} />
}
