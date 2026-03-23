"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { DashboardModuleLinks } from "@/components/dashboard/dashboard-module-links"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import {
  Fuel,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkOrder {
  id: string
  order_id: string
  description: string | null
  type: string | null
  priority: string | null
  status: string | null
  created_at: string | null
  asset?: { id: string; name: string; asset_id: string } | null
}

interface Incident {
  id: string
  asset_display_name?: string | null
  asset_code?: string | null
  description?: string | null
  date?: string | null
  status?: string | null
}

interface IncidentGroup {
  assetName: string
  assetCode: string | null
  count: number
  ids: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = ["Pending", "Programmed", "WaitingParts", "En ejecución", "En Progreso", "Esperando Partes", "Cotizada", "Aprobada"]

function formatAge(createdAt: string | null | undefined): string {
  if (!createdAt) return ""
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  if (days === 0) return "hoy"
  if (days === 1) return "1d"
  return `${days}d`
}

const PRIORITY_COLORS: Record<string, string> = {
  Alta: "bg-red-100 text-red-700",
  Media: "bg-amber-100 text-amber-700",
  Baja: "bg-slate-100 text-slate-600",
  Crítica: "bg-red-200 text-red-800",
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoordinadorDashboard() {
  const { profile, ui, isLoading: authLoading, isInitialized, isAuthenticated } = useAuthZustand()
  const router = useRouter()

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [pendingChecklists, setPendingChecklists] = useState<number>(0)
  const [dataLoading, setDataLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Role guard
  useEffect(() => {
    if (!isInitialized || authLoading) return
    if (!isAuthenticated || !profile) {
      router.push("/login")
      return
    }
    if (profile.role !== "COORDINADOR_MANTENIMIENTO") {
      router.push("/dashboard")
    }
  }, [isInitialized, authLoading, isAuthenticated, profile, router])

  const loadData = useCallback(async () => {
    try {
      setDataLoading(true)

      const [woRes, incRes, chkRes] = await Promise.all([
        fetch("/api/work-orders/list", { credentials: "include", cache: "no-store" }),
        fetch("/api/incidents", { credentials: "include", cache: "no-store" }),
        fetch("/api/checklists/schedules?status=pendiente", { credentials: "include", cache: "no-store" }),
      ])

      if (woRes.ok) {
        const woData = await woRes.json()
        const allWOs: WorkOrder[] = woData.workOrders ?? []
        const active = allWOs.filter((wo) =>
          ACTIVE_STATUSES.some((s) => wo.status?.toLowerCase() === s.toLowerCase())
        )
        setWorkOrders(active.slice(0, 6))
      }

      if (incRes.ok) {
        const incData = await incRes.json()
        setIncidents(incData ?? [])
      }

      if (chkRes.ok) {
        const chkData = await chkRes.json()
        const schedules = Array.isArray(chkData) ? chkData : (chkData.schedules ?? chkData.data ?? [])
        setPendingChecklists(schedules.length)
      }
    } catch (err) {
      console.error("[CoordinadorDashboard] Error loading data:", err)
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isInitialized && !authLoading && profile?.role === "COORDINADOR_MANTENIMIENTO") {
      loadData()
    }
  }, [isInitialized, authLoading, profile?.role, loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  // Group incidents by asset
  const incidentGroups: IncidentGroup[] = Object.values(
    incidents.reduce((acc: Record<string, IncidentGroup>, inc) => {
      const key = inc.asset_display_name ?? inc.asset_code ?? "Equipo desconocido"
      if (!acc[key]) {
        acc[key] = { assetName: key, assetCode: inc.asset_code ?? null, count: 0, ids: [] }
      }
      acc[key].count++
      acc[key].ids.push(inc.id)
      return acc
    }, {})
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const totalIncidents = incidents.length

  // Module list for this role
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

  // ─── Loading / auth states ────────────────────────────────────────────────

  if (!isInitialized || authLoading) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Cargando…" text="Preparando tu dashboard de coordinación." />
        <div className="flex min-h-[280px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardShell>
    )
  }

  if (!isAuthenticated || !profile || profile.role !== "COORDINADOR_MANTENIMIENTO") {
    return null // redirect handled in useEffect
  }

  // ─── Content ──────────────────────────────────────────────────────────────

  const hasAttention = workOrders.length > 0 || totalIncidents > 0

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={refreshing}>
      <DashboardShell className="space-y-6">
        <DashboardHeader
          heading={`Hola, ${profile.nombre}`}
          text={
            profile.plant_id
              ? "Coordinador de Mantenimiento · Tu zona"
              : "Coordinador de Mantenimiento"
          }
        >
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
        </DashboardHeader>

        {/* Attention strip */}
        {hasAttention && !dataLoading && (
          <div className="callout-attention flex flex-wrap items-center gap-x-4 gap-y-1">
            {workOrders.length > 0 && (
              <span className="text-sm font-medium text-amber-900">
                {workOrders.length} {workOrders.length === 1 ? "orden activa" : "órdenes activas"}
              </span>
            )}
            {totalIncidents > 0 && (
              <>
                {workOrders.length > 0 && <span className="text-amber-400">·</span>}
                <span className="text-sm font-medium text-amber-900">
                  {totalIncidents} {totalIncidents === 1 ? "incidente abierto" : "incidentes abiertos"}
                </span>
              </>
            )}
            {pendingChecklists > 0 && (
              <>
                <span className="text-amber-400">·</span>
                <span className="text-sm font-medium text-amber-900">
                  {pendingChecklists} {pendingChecklists === 1 ? "checklist pendiente" : "checklists pendientes"}
                </span>
              </>
            )}
          </div>
        )}

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Link href="/ordenes/crear">
            <Button size="sm" className="min-h-[44px] gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Crear OT
            </Button>
          </Link>
          <Link href="/compras/crear">
            <Button size="sm" variant="outline" className="min-h-[44px] gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Crear OC
            </Button>
          </Link>
          <Link href="/checklists">
            <Button size="sm" variant="outline" className="min-h-[44px] gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Checklists
              {pendingChecklists > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {pendingChecklists}
                </span>
              )}
            </Button>
          </Link>
        </div>

        {/* Main grid: OTs + Incidents */}
        <div className="grid gap-4 md:grid-cols-2">

          {/* Active work orders */}
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Órdenes activas</span>
                {!dataLoading && workOrders.length > 0 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-num">
                    {workOrders.length}
                  </span>
                )}
              </div>
              <Link
                href="/ordenes"
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Ver todas →
              </Link>
            </div>

            {dataLoading ? (
              <div className="flex items-center gap-3 px-4 py-5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cargando…</span>
              </div>
            ) : workOrders.length === 0 ? (
              <div className="px-4 py-5 text-sm text-muted-foreground">Sin órdenes activas</div>
            ) : (
              <div className="divide-y divide-border/40">
                {workOrders.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/ordenes/${wo.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60 min-h-[52px]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold tabular-num text-muted-foreground">
                          {wo.order_id}
                        </span>
                        {wo.type && (
                          <span className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                            wo.type.toLowerCase().includes("prev")
                              ? "bg-green-100 text-green-700"
                              : "bg-orange-100 text-orange-700"
                          )}>
                            {wo.type}
                          </span>
                        )}
                        {wo.created_at && (
                          <span className="text-[10px] text-muted-foreground">{formatAge(wo.created_at)}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate mt-0.5">
                        {wo.asset?.name ?? wo.description ?? "—"}
                      </p>
                    </div>
                    {wo.priority && (
                      <span className={cn(
                        "hidden sm:inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                        PRIORITY_COLORS[wo.priority] ?? "bg-muted text-muted-foreground"
                      )}>
                        {wo.priority}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Incidents grouped by asset */}
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Incidentes abiertos</span>
                {!dataLoading && totalIncidents > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 tabular-num">
                    {totalIncidents}
                  </span>
                )}
              </div>
              <Link
                href="/incidentes"
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
            ) : incidentGroups.length === 0 ? (
              <div className="px-4 py-5 text-sm text-muted-foreground">Sin incidentes abiertos</div>
            ) : (
              <div className="divide-y divide-border/40">
                {incidentGroups.map((group) => (
                  <Link
                    key={group.assetName}
                    href={`/incidentes?asset=${group.assetCode ?? ""}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60 min-h-[52px]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.assetName}</p>
                      {group.assetCode && (
                        <p className="text-xs text-muted-foreground">{group.assetCode}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="tabular-num shrink-0">
                      {group.count} {group.count === 1 ? "incidente" : "incidentes"}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Checklist status summary */}
        {pendingChecklists > 0 && !dataLoading && (
          <Alert className="border-amber-200 bg-amber-50">
            <ClipboardList className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>{pendingChecklists} {pendingChecklists === 1 ? "checklist pendiente" : "checklists pendientes"}</strong> en tu zona.{" "}
              <Link href="/checklists" className="font-semibold underline underline-offset-2">
                Revisar →
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Modules — compact navigation supplement */}
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

      </DashboardShell>
    </PullToRefresh>
  )
}
