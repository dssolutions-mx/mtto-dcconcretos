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
  Users,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { DashboardModuleLinks } from "@/components/dashboard/dashboard-module-links"

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusDisplay(status: string | null) {
  const s = status?.toLowerCase() ?? ""
  if (s === "completado" || s === "completed") {
    return { label: "Completado", color: "text-green-700", bg: "bg-green-50" }
  }
  if (s === "pendiente" || s === "pending") {
    return { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50" }
  }
  if (s === "vencido" || s === "overdue") {
    return { label: "Vencido", color: "text-red-700", bg: "bg-red-50" }
  }
  return { label: status ?? "—", color: "text-muted-foreground", bg: "bg-muted/40" }
}

function isIssue(status: string | null) {
  const s = status?.toLowerCase() ?? ""
  return s === "pendiente" || s === "pending" || s === "vencido" || s === "overdue"
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

  // Sort: pending/overdue first, then completed
  const sortedSchedules = [...schedules].sort((a, b) => {
    const aIssue = isIssue(a.status) ? 0 : 1
    const bIssue = isIssue(b.status) ? 0 : 1
    return aIssue - bIssue
  })

  // Module list
  const moduleCards = [
    { title: "Diésel", href: "/diesel", icon: Fuel, module: "inventory" as const },
    { title: "Activos", href: "/activos", icon: Package, module: "assets" as const },
    { title: "Mantenimiento", href: "/preventivo", icon: Wrench, module: "maintenance" as const },
    { title: "Órdenes de Trabajo", href: "/ordenes", icon: FileText, module: "work_orders" as const },
    { title: "Compras", href: "/compras", icon: ShoppingCart, module: "purchases" as const },
    { title: "Checklists", href: "/checklists", icon: ClipboardList, module: "checklists" as const },
    { title: "Personal", href: "/gestion/personal", icon: Users, module: "personnel" as const },
    { title: "Reportes", href: "/reportes", icon: BarChart3, module: "reports" as const },
  ]

  // ─── Loading / auth ────────────────────────────────────────────────────────

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

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={refreshing}>
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">
              {profile.nombre} {profile.apellido}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Jefe de Planta{plantName ? ` · ${plantName}` : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="shrink-0"
          >
            {refreshing
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <RefreshCw className="h-3 w-3" />}
            <span className="ml-1.5 hidden sm:inline">Actualizar</span>
          </Button>
        </div>

        {/* Hero action strip */}
        {!dataLoading && total > 0 && (
          <>
            {issueCount > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center gap-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900">
                    {issueCount} {issueCount === 1 ? "checklist requiere atención" : "checklists requieren atención"}
                  </p>
                  <p className="text-xs text-amber-700">
                    {doneCount}/{total} completados
                    {compliancePct !== null && ` · ${compliancePct}% cumplimiento`}
                  </p>
                </div>
                <Button asChild size="sm" className="shrink-0">
                  <Link href="/checklists">Ver checklists</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-center gap-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-800">
                    Todo al día · {doneCount}/{total} completados
                  </p>
                  <p className="text-xs text-green-700">Cumplimiento: 100%</p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0 border-green-300 text-green-800 hover:bg-green-100">
                  <Link href="/checklists">Ver checklists</Link>
                </Button>
              </div>
            )}
          </>
        )}

        {/* Quick shortcuts */}
        <div className="flex flex-wrap gap-2">
          <Link href="/diesel">
            <Button size="sm" variant="outline" className="min-h-[44px] gap-1.5">
              <Fuel className="h-3.5 w-3.5" />
              Diesel de hoy
            </Button>
          </Link>
          <Link href="/activos">
            <Button size="sm" variant="outline" className="min-h-[44px] gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Activos
            </Button>
          </Link>
          <Link href="/incidentes">
            <Button size="sm" variant="outline" className="min-h-[44px] gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Incidentes
            </Button>
          </Link>
          <Link href="/gestion/personal">
            <Button size="sm" variant="outline" className="min-h-[44px] gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Personal
            </Button>
          </Link>
        </div>

        {/* Checklist schedule table */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Checklists de hoy</span>
              {!dataLoading && total > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-num">
                  {doneCount}/{total}
                </span>
              )}
            </div>
            <Link
              href="/checklists"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver todos →
            </Link>
          </div>

          {dataLoading ? (
            <div className="flex items-center gap-3 px-4 py-5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cargando…</span>
            </div>
          ) : sortedSchedules.length === 0 ? (
            <div className="px-4 py-5 text-sm text-muted-foreground">
              Sin checklists programados
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {sortedSchedules.slice(0, 8).map((sched) => {
                const operatorName = sched.assigned_profile
                  ? `${sched.assigned_profile.nombre ?? ""} ${sched.assigned_profile.apellido ?? ""}`.trim()
                  : "Sin asignar"
                const assetName = sched.asset?.name ?? sched.checklist?.title ?? "—"
                const statusDisplay = getStatusDisplay(sched.status)

                return (
                  <Link
                    key={sched.id}
                    href={`/checklists/${sched.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60 min-h-[52px]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{operatorName}</p>
                      <p className="text-xs text-muted-foreground truncate">{assetName}</p>
                    </div>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
                      statusDisplay.bg,
                      statusDisplay.color
                    )}>
                      {statusDisplay.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </Link>
                )
              })}
              {sortedSchedules.length > 8 && (
                <div className="px-4 py-3">
                  <Link
                    href="/checklists"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    + {sortedSchedules.length - 8} más →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modules */}
        <div className="pt-4 border-t border-border/40">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Módulos
          </p>
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
        </div>

      </div>
    </PullToRefresh>
  )
}
