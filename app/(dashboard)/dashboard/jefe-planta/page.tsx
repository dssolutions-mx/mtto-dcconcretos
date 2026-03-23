"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Fuel,
  Loader2,
  Package,
  RefreshCw,
  ShoppingCart,
  Target,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { DashboardModuleLinks } from "@/components/dashboard/dashboard-module-links"
import { DashboardExecutiveLayout } from "@/components/dashboard/dashboard-executive-layout"
import { DashboardExecutiveHero } from "@/components/dashboard/dashboard-executive-hero"
import { DashboardActionStrip } from "@/components/dashboard/dashboard-action-strip"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChecklistSchedule {
  id: string
  status: string | null
  asset?: { name?: string; asset_id?: string } | null
  assigned_to?: string | null
  assigned_profile?: { nombre?: string; apellido?: string } | null
  scheduled_date?: string | null
  checklist?: { title?: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isIssue(status: string | null) {
  const s = status?.toLowerCase() ?? ""
  return s === "pendiente" || s === "pending" || s === "vencido" || s === "overdue"
}

function getStatusDisplay(status: string | null) {
  const s = status?.toLowerCase() ?? ""
  if (s === "completado" || s === "completed") {
    return { label: "Completado", color: "text-green-700", bg: "bg-green-50 border border-green-200" }
  }
  if (s === "pendiente" || s === "pending") {
    return { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50 border border-amber-200" }
  }
  if (s === "vencido" || s === "overdue") {
    return { label: "Vencido", color: "text-red-700", bg: "bg-red-50 border border-red-200" }
  }
  return { label: status ?? "—", color: "text-muted-foreground", bg: "bg-muted/40" }
}

// ─── Compliance KPI card ──────────────────────────────────────────────────────

function ComplianceKpiCard({
  label,
  value,
  subtitle,
  accentClass,
  href,
}: {
  label: string
  value: string | number
  subtitle: string
  accentClass: string
  href?: string
}) {
  const inner = (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden",
        "rounded-2xl border border-border/60 bg-card",
        "px-4 py-4 sm:px-6 sm:py-5",
        "transition-all hover:border-border hover:shadow-sm",
        "min-h-[110px] sm:min-h-[130px]"
      )}
    >
      {/* Colored top accent */}
      <div className={cn("absolute inset-x-0 top-0 h-[3px] rounded-t-2xl", accentClass)} />

      {/* Label */}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight sm:text-[11px] sm:tracking-widest">
        {label}
      </span>

      {/* Value */}
      <div className="mt-3 flex-1">
        <p
          className="font-bold leading-none tracking-tight tabular-num"
          style={{ fontSize: "clamp(1.6rem, 5.5vw, 2.4rem)" }}
        >
          {value}
        </p>
        <p className="mt-1.5 text-[10px] text-muted-foreground/60">{subtitle}</p>
      </div>
    </div>
  )

  if (href) return <Link href={href} className="block">{inner}</Link>
  return inner
}

function KpiCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border/40 bg-card px-4 py-4 sm:px-6 sm:py-5 min-h-[110px] sm:min-h-[130px]">
      <div className="h-2.5 w-24 rounded bg-muted/50" />
      <div className="mt-4 h-10 w-20 rounded bg-muted/60" />
      <div className="mt-2 h-2.5 w-16 rounded bg-muted/40" />
    </div>
  )
}

// ─── Checklist queue ──────────────────────────────────────────────────────────

function ChecklistQueue({
  schedules,
  totalCount,
  issueCount,
  isLoading,
}: {
  schedules: ChecklistSchedule[]
  totalCount: number
  issueCount: number
  isLoading: boolean
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">Checklists de hoy</span>
          {!isLoading && totalCount > 0 && (
            <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-background tabular-num min-w-[22px]">
              {totalCount}
            </span>
          )}
          {!isLoading && issueCount > 0 && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              {issueCount} pendientes
            </span>
          )}
        </div>
        {totalCount > 0 && !isLoading && (
          <Link
            href="/checklists"
            className="shrink-0 ml-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver todos →
          </Link>
        )}
      </div>

      {/* Rows */}
      {isLoading ? (
        <div className="divide-y divide-border/40">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse sm:px-5">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-muted/60" />
                <div className="h-2.5 w-44 rounded bg-muted/40" />
              </div>
              <div className="h-5 w-20 rounded-full bg-muted/50" />
            </div>
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5 sm:px-5">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-muted-foreground">Sin checklists programados</span>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {schedules.map((sched, idx) => {
            const operatorName = sched.assigned_profile
              ? `${sched.assigned_profile.nombre ?? ""} ${sched.assigned_profile.apellido ?? ""}`.trim()
              : "Sin asignar"
            const assetName = sched.asset?.name ?? sched.checklist?.title ?? "—"
            const statusDisplay = getStatusDisplay(sched.status)

            return (
              <Link
                key={sched.id}
                href={`/checklists/${sched.id}`}
                className={cn(
                  "group grid items-center gap-x-3 px-4 transition-colors hover:bg-muted/40 active:bg-muted/60 sm:px-5",
                  "grid-cols-[1fr_auto] sm:grid-cols-[1.5rem_1fr_auto]",
                  "min-h-[60px] py-3"
                )}
              >
                {/* Row index — desktop only */}
                <span className="hidden sm:block text-center text-xs font-medium text-muted-foreground/40 tabular-num">
                  {idx + 1}
                </span>

                {/* Operator + asset */}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{operatorName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{assetName}</p>
                </div>

                {/* Status badge + chevron */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none",
                      statusDisplay.bg,
                      statusDisplay.color
                    )}
                  >
                    {statusDisplay.label}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JefePlantaDashboard() {
  const { profile, ui, isLoading: authLoading, isInitialized, isAuthenticated } = useAuthZustand()
  const router = useRouter()

  const [schedules, setSchedules] = useState<ChecklistSchedule[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Role guard
  useEffect(() => {
    if (!isInitialized || authLoading) return
    if (!isAuthenticated || !profile) {
      router.push("/login")
      return
    }
    if (profile.role !== "JEFE_PLANTA") {
      router.push("/dashboard")
    }
  }, [isInitialized, authLoading, isAuthenticated, profile, router])

  const loadData = useCallback(async () => {
    try {
      setDataLoading(true)
      const res = await fetch("/api/checklists/schedules", {
        credentials: "include",
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data.schedules ?? data.data ?? [])
        setSchedules(list)
      }
    } catch (err) {
      console.error("[JefePlantaDashboard] Error loading data:", err)
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isInitialized && !authLoading && profile?.role === "JEFE_PLANTA") {
      loadData()
    }
  }, [isInitialized, authLoading, profile?.role, loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  // ─── Derived stats ────────────────────────────────────────────────────────

  const total = schedules.length
  const issueSchedules = schedules.filter((s) => isIssue(s.status))
  const doneCount = schedules.filter((s) => {
    const st = s.status?.toLowerCase() ?? ""
    return st === "completado" || st === "completed"
  }).length
  const issueCount = issueSchedules.length
  const compliancePct = total > 0 ? Math.round((doneCount / total) * 100) : null

  // Count of distinct operators who have pending/overdue checklists today
  // This is the spec metric: "N operadores sin checklist hoy"
  const operatorsWithIssues = new Set(
    issueSchedules.filter((s) => s.assigned_to).map((s) => s.assigned_to)
  ).size

  // Sort: pending/overdue first
  const sortedSchedules = [...schedules].sort((a, b) => {
    return (isIssue(a.status) ? 0 : 1) - (isIssue(b.status) ? 0 : 1)
  })

  const moduleCards = [
    { title: "Personal", href: "/gestion/personal", icon: Users, module: "personnel" as const },
    { title: "Asignaciones", href: "/gestion/asignaciones", icon: Target, module: "personnel" as const },
    { title: "Diésel", href: "/diesel", icon: Fuel, module: "inventory" as const },
    { title: "Activos", href: "/activos", icon: Package, module: "assets" as const },
    { title: "Mantenimiento", href: "/preventivo", icon: Wrench, module: "maintenance" as const },
    { title: "Órdenes de Trabajo", href: "/ordenes", icon: FileText, module: "work_orders" as const },
    { title: "Compras", href: "/compras", icon: ShoppingCart, module: "purchases" as const },
    { title: "Checklists", href: "/checklists", icon: ClipboardList, module: "checklists" as const },
    { title: "Reportes", href: "/reportes", icon: BarChart3, module: "reports" as const },
  ]

  // ─── Loading / auth ───────────────────────────────────────────────────────

  if (!isInitialized || authLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated || !profile || profile.role !== "JEFE_PLANTA") {
    return null
  }

  // ─── Content ──────────────────────────────────────────────────────────────

  const plantName = profile.plants?.name ?? null
  const roleSubtitle = ["Jefe de Planta", plantName].filter(Boolean).join(" · ")

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={refreshing}>
      <DashboardExecutiveLayout
        hero={
          <DashboardExecutiveHero
            name={`${profile.nombre} ${profile.apellido}`}
            role={roleSubtitle}
          />
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 w-8 p-0 sm:w-auto sm:px-3"
            aria-label="Actualizar"
          >
            {refreshing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline ml-1.5 text-xs">Actualizar</span>
          </Button>
        }
        shortcuts={[
          { label: "Gestión de personal", href: "/gestion/personal", icon: <Users className="h-4 w-4" /> },
          { label: "Alta de usuario", href: "/gestion/personal?registrar=1", icon: <UserPlus className="h-4 w-4" /> },
          { label: "Asignaciones organizacionales", href: "/gestion/asignaciones", icon: <Target className="h-4 w-4" /> },
          { label: "Asignación operador-activo", href: "/organizacion/asignacion-activos", icon: <UserCheck className="h-4 w-4" /> },
          { label: "Autorizar anomalía", href: "/incidentes", icon: <AlertTriangle className="h-4 w-4" /> },
        ]}
        kpis={
          <div className="space-y-5">

            {/* Section label */}
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Cumplimiento de tu planta
            </p>

            {/* Hero action strip — spec: "N operadores sin checklist hoy → [Ver cumplimiento]" */}
            <DashboardActionStrip
              icon={ClipboardList}
              count={operatorsWithIssues}
              label="operadores sin checklist hoy"
              href="/compliance"
              ctaLabel="Ver cumplimiento"
            />

            {/* Compliance KPI cards */}
            {total > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {dataLoading ? (
                  <>
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                  </>
                ) : (
                  <>
                    <ComplianceKpiCard
                      label="Completados"
                      value={`${doneCount}/${total}`}
                      subtitle="de los checklists de hoy"
                      accentClass={
                        doneCount === total
                          ? "bg-gradient-to-r from-green-400 to-emerald-300"
                          : "bg-gradient-to-r from-slate-400 to-slate-300"
                      }
                      href="/checklists"
                    />
                    <ComplianceKpiCard
                      label="Cumplimiento"
                      value={compliancePct !== null ? `${compliancePct}%` : "—"}
                      subtitle={
                        compliancePct === 100
                          ? "Todo al día"
                          : compliancePct !== null
                          ? `${issueCount} ${issueCount === 1 ? "requiere atención" : "requieren atención"}`
                          : "Sin datos"
                      }
                      accentClass={
                        compliancePct === 100
                          ? "bg-gradient-to-r from-green-400 to-emerald-300"
                          : "bg-gradient-to-r from-amber-400 to-orange-300"
                      }
                      href="/compliance"
                    />
                  </>
                )}
              </div>
            )}

            {/* Checklist queue */}
            <ChecklistQueue
              schedules={sortedSchedules.slice(0, 8)}
              totalCount={total}
              issueCount={issueCount}
              isLoading={dataLoading}
            />

          </div>
        }
        modules={
          <DashboardModuleLinks
            modules={moduleCards
              .filter((c) => ui.shouldShowInNavigation(c.module))
              .map((c) => ({
                title: c.title,
                href: c.href,
                icon: c.icon,
                hasAccess: true,
              }))}
          />
        }
      />
    </PullToRefresh>
  )
}
