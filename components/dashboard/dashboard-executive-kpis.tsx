"use client"

import Link from "next/link"
import { Fuel, TrendingDown, TrendingUp, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDashboardMaintenanceCost } from "@/hooks/useDashboardMaintenanceCost"
import { useDashboardApprovalQueue } from "@/hooks/useDashboardApprovalQueue"
import { DashboardApprovalQueue } from "./dashboard-approval-queue"

export type ExecutiveKpiRole = "GERENCIA_GENERAL" | "GERENTE_MANTENIMIENTO" | "AREA_ADMINISTRATIVA"

// ─── Cost card ────────────────────────────────────────────────────────────────

function CostCard({
  label,
  value,
  lastMonthValue,
  icon: Icon,
  accentClass,
  href,
}: {
  label: string
  value: number
  lastMonthValue?: number | null
  icon: React.ComponentType<{ className?: string }>
  /** Tailwind bg class for the top accent line */
  accentClass: string
  href?: string
}) {
  const formatted = value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  })

  const delta = lastMonthValue != null && lastMonthValue > 0 ? value - lastMonthValue : null
  const trend = delta === null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "neutral"
  const deltaFormatted =
    delta !== null
      ? Math.abs(delta).toLocaleString("es-MX", {
          style: "currency",
          currency: "MXN",
          maximumFractionDigits: 0,
        })
      : null

  const inner = (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden",
        "rounded-2xl border border-border/60 bg-card",
        "px-4 py-4 sm:px-6 sm:py-5",
        "transition-all hover:border-border hover:shadow-sm",
        "min-h-[120px] sm:min-h-[150px]"
      )}
    >
      {/* Colored top accent */}
      <div className={cn("absolute inset-x-0 top-0 h-[3px] rounded-t-2xl", accentClass)} />

      {/* Icon only on mobile (saves horizontal space), icon+label on sm+ */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 sm:h-8 sm:w-8">
          <Icon className="h-3.5 w-3.5 text-foreground/70 sm:h-4 sm:w-4" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight sm:text-[11px] sm:tracking-widest">
          {label}
        </span>
      </div>

      {/* Main value — fluid size: clamps between 1.5rem and 2.5rem */}
      <div className="mt-3 flex-1">
        <p
          className="font-bold leading-none tracking-tight tabular-num"
          style={{ fontSize: "clamp(1.4rem, 5.5vw, 2.5rem)" }}
        >
          {formatted}
        </p>

        {deltaFormatted && trend && trend !== "neutral" ? (
          <div className="mt-2 flex items-center gap-1">
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3 text-amber-500 shrink-0" />
            ) : (
              <TrendingDown className="h-3 w-3 text-green-600 shrink-0" />
            )}
            <span
              className={cn(
                "text-[10px] font-medium sm:text-xs",
                trend === "up" ? "text-amber-600" : "text-green-700"
              )}
            >
              {trend === "up" ? "+" : "−"}
              {deltaFormatted} vs mes ant.
            </span>
          </div>
        ) : (
          lastMonthValue == null && (
            <p className="mt-1.5 text-[10px] text-muted-foreground/50">Sin comparativa anterior</p>
          )
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    )
  }
  return inner
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CostCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border/40 bg-card px-5 py-4 sm:px-6 sm:py-5 min-h-[130px] sm:min-h-[150px]">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-xl bg-muted/60" />
        <div className="h-2.5 w-28 rounded bg-muted/50" />
      </div>
      <div className="mt-5 h-9 w-36 rounded bg-muted/60" />
      <div className="mt-2.5 h-2.5 w-24 rounded bg-muted/40" />
    </div>
  )
}

// ─── Shared cost + queue view ─────────────────────────────────────────────────

function CostAndQueueView({
  sectionTitle,
  queueTitle,
  hideStageLabel,
}: {
  sectionTitle: string
  queueTitle: string
  hideStageLabel?: boolean
}) {
  const { current, lastMonth, isLoading: costLoading } = useDashboardMaintenanceCost()
  const {
    items,
    approvalContext,
    totalCount,
    isLoading: queueLoading,
    myStage,
  } = useDashboardApprovalQueue()

  return (
    <div className="space-y-5">
      {/* Section label */}
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {sectionTitle}
      </p>

      {/* Cost cards — horizontal scroll on very narrow screens, 2-col on sm+ */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {costLoading ? (
          <>
            <CostCardSkeleton />
            <CostCardSkeleton />
          </>
        ) : (
          <>
            <CostCard
              label="Mantenimiento"
              value={current.maintenanceCost}
              lastMonthValue={lastMonth?.maintenanceCost}
              icon={Wrench}
              accentClass="bg-gradient-to-r from-slate-400 to-slate-300"
              href="/reportes/gerencial"
            />
            <CostCard
              label="Diésel"
              value={current.dieselCost}
              lastMonthValue={lastMonth?.dieselCost}
              icon={Fuel}
              accentClass="bg-gradient-to-r from-amber-400 to-orange-300"
              href="/diesel"
            />
          </>
        )}
      </div>

      {/* Approval queue */}
      <DashboardApprovalQueue
        items={items}
        approvalContext={approvalContext}
        totalCount={totalCount}
        isLoading={queueLoading}
        myStage={myStage}
        viewAllHref="/compras?tab=pending"
        title={queueTitle}
        hideStageLabel={hideStageLabel}
      />
    </div>
  )
}

// ─── Role-specific views ───────────────────────────────────────────────────────

function GMView() {
  return (
    <CostAndQueueView
      sectionTitle="Resumen estratégico"
      queueTitle="Órdenes pendientes de aprobación final"
    />
  )
}

function OperationalView({ role }: { role: "GERENTE_MANTENIMIENTO" | "AREA_ADMINISTRATIVA" }) {
  const queueTitle =
    role === "GERENTE_MANTENIMIENTO"
      ? "Órdenes pendientes de validación técnica"
      : "Órdenes pendientes de viabilidad"

  return (
    <CostAndQueueView
      sectionTitle="Resumen operativo"
      queueTitle={queueTitle}
    />
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function DashboardExecutiveKPIs({ role }: { role: ExecutiveKpiRole }) {
  if (role === "GERENCIA_GENERAL") return <GMView />
  return <OperationalView role={role} />
}
