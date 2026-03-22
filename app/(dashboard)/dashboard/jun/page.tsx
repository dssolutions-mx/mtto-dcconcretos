"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  BarChart3,
  Building2,
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
import { Badge } from "@/components/ui/badge"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { DashboardModuleLinks } from "@/components/dashboard/dashboard-module-links"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkOrder {
  id: string
  order_id: string
  description: string | null
  type: string | null
  priority: string | null
  status: string | null
  created_at: string | null
  asset?: { id: string; name: string; asset_id: string; plant_id?: string | null } | null
}

interface Incident {
  id: string
  asset_display_name?: string | null
  asset_code?: string | null
  description?: string | null
  date?: string | null
  status?: string | null
  assets?: { id?: string; name?: string; asset_id?: string; plant_id?: string | null } | null
}

interface IncidentGroup {
  assetName: string
  assetCode: string | null
  count: number
  ids: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = [
  "Pending",
  "Programmed",
  "WaitingParts",
  "En ejecución",
  "En Progreso",
  "Esperando Partes",
  "Cotizada",
  "Aprobada",
]

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

export default function JUNDashboard() {
  const { profile, ui, isLoading: authLoading, isInitialized, isAuthenticated } = useAuthZustand()
  const router = useRouter()

  const [plantIdsInBu, setPlantIdsInBu] = useState<Set<string>>(new Set())
  const [plantCount, setPlantCount] = useState(0)
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [pendingChecklists, setPendingChecklists] = useState(0)
  const [dataLoading, setDataLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Role guard
  useEffect(() => {
    if (!isInitialized || authLoading) return
    if (!isAuthenticated || !profile) {
      router.push("/login")
      return
    }
    if (profile.role !== "JEFE_UNIDAD_NEGOCIO") {
      router.push("/dashboard")
    }
  }, [isInitialized, authLoading, isAuthenticated, profile, router])

  const loadData = useCallback(async () => {
    if (profile?.role !== "JEFE_UNIDAD_NEGOCIO") return
    try {
      setDataLoading(true)

      const buId = profile.business_unit_id ?? null

      const [plantsRes, woRes, incRes, chkRes] = await Promise.all([
        fetch("/api/plants", { credentials: "include", cache: "no-store" }),
        fetch("/api/work-orders/list", { credentials: "include", cache: "no-store" }),
        fetch("/api/incidents", { credentials: "include", cache: "no-store" }),
        fetch("/api/checklists/schedules?status=pendiente", { credentials: "include", cache: "no-store" }),
      ])

      let plantSet = new Set<string>()
      if (plantsRes.ok && buId) {
        const plantsJson = await plantsRes.json()
        const plants: Array<{ id: string; business_unit_id?: string | null }> = plantsJson.plants ?? []
        plantSet = new Set(plants.filter((p) => p.business_unit_id === buId).map((p) => p.id))
        setPlantCount(plantSet.size)
      }
      setPlantIdsInBu(plantSet)

      if (woRes.ok) {
        const woData = await woRes.json()
        const allWOs: WorkOrder[] = woData.workOrders ?? []
        const active = allWOs.filter((wo) =>
          ACTIVE_STATUSES.some((s) => wo.status?.toLowerCase() === s.toLowerCase())
        )
        let scoped = active
        if (buId && plantSet.size > 0) {
          scoped = active.filter((wo) => {
            const pid = wo.asset?.plant_id
            return !!pid && plantSet.has(pid)
          })
        } else if (buId && plantSet.size === 0) {
          scoped = []
        }
        setWorkOrders(scoped.slice(0, 6))
      }

      if (incRes.ok) {
        const incData = await incRes.json()
        const list: Incident[] = Array.isArray(incData) ? incData : []
        let scoped = list
        if (buId && plantSet.size > 0) {
          scoped = list.filter((inc) => {
            const pid = inc.assets?.plant_id
            return !!pid && plantSet.has(pid)
          })
        } else if (buId && plantSet.size === 0) {
          scoped = []
        }
        setIncidents(scoped)
      }

      if (chkRes.ok) {
        const chkData = await chkRes.json()
        const schedules = Array.isArray(chkData) ? chkData : (chkData.schedules ?? chkData.data ?? [])
        setPendingChecklists(schedules.length)
      }
    } catch (err) {
      console.error("[JUNDashboard] load error:", err)
    } finally {
      setDataLoading(false)
    }
  }, [profile?.role, profile?.business_unit_id])

  useEffect(() => {
    if (isInitialized && !authLoading && profile?.role === "JEFE_UNIDAD_NEGOCIO") {
      void loadData()
    }
  }, [isInitialized, authLoading, profile?.role, loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

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
  const pendingServicesCount = workOrders.length + totalIncidents
  const buScoped = !!profile?.business_unit_id && plantIdsInBu.size > 0

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

  if (!isAuthenticated || !profile || profile.role !== "JEFE_UNIDAD_NEGOCIO") {
    return null
  }

  // ─── Content ──────────────────────────────────────────────────────────────

  const buName = profile.business_units?.name ?? null

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={refreshing}>
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Hola, {profile.nombre}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Jefe de Unidad de Negocio
              {buName ? ` · ${buName}` : ""}
              {buScoped && plantCount > 0 ? ` · ${plantCount} ${plantCount === 1 ? "planta" : "plantas"}` : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="shrink-0"
          >
            {refreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            <span className="ml-1.5 hidden sm:inline">Actualizar</span>
          </Button>
        </div>

        {/* Warning: no BU assigned */}
        {!profile.business_unit_id && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Tu perfil no tiene unidad de negocio asignada. Los datos mostrados pueden estar incompletos.
          </p>
        )}

        {/* Hero action strip */}
        {!dataLoading && (
          <>
            {pendingServicesCount > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center gap-4">
                <Building2 className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900">
                    {pendingServicesCount}{" "}
                    {pendingServicesCount === 1 ? "servicio activo" : "servicios activos"} en tu unidad
                  </p>
                  <p className="text-xs text-amber-700">
                    {workOrders.length > 0 && `${workOrders.length} ${workOrders.length === 1 ? "orden" : "órdenes"}`}
                    {workOrders.length > 0 && totalIncidents > 0 && " · "}
                    {totalIncidents > 0 && `${totalIncidents} ${totalIncidents === 1 ? "incidente" : "incidentes"}`}
                  </p>
                </div>
                <Button asChild size="sm" className="shrink-0">
                  <Link href="/ordenes">Ver órdenes</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-center gap-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-800">Sin servicios activos en tu unidad</p>
                  <p className="text-xs text-green-700">
                    {buScoped
                      ? `${plantCount} ${plantCount === 1 ? "planta" : "plantas"} al día`
                      : "Todo en orden"}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Compact KPI strip */}
        {!dataLoading && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/60 bg-card px-3 py-3 text-center">
              <p className="text-lg font-bold tabular-num">{workOrders.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">OTs activas</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card px-3 py-3 text-center">
              <p className={cn("text-lg font-bold tabular-num", totalIncidents > 0 && "text-amber-600")}>
                {totalIncidents}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Incidentes</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card px-3 py-3 text-center">
              <p className={cn("text-lg font-bold tabular-num", pendingChecklists > 0 && "text-amber-600")}>
                {pendingChecklists}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Checklists pendientes</p>
            </div>
          </div>
        )}

        {/* Quick shortcuts */}
        <div className="flex flex-wrap gap-2">
          <Link href="/incidentes">
            <Button size="sm" variant="outline" className="min-h-[44px] gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Incidentes
            </Button>
          </Link>
          <Link href="/compliance">
            <Button size="sm" variant="outline" className="min-h-[44px] gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Cumplimiento
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
          <Link href="/reportes">
            <Button size="sm" variant="outline" className="min-h-[44px] gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Reportes
            </Button>
          </Link>
        </div>

        {/* Detail grid: Work orders + Incidents */}
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
              <div className="px-4 py-5 text-sm text-muted-foreground">
                Sin órdenes activas{buScoped ? " en tu unidad" : ""}
              </div>
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
                        <span className="text-xs font-semibold tabular-num text-muted-foreground">{wo.order_id}</span>
                        {wo.type && (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              wo.type.toLowerCase().includes("prev")
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            )}
                          >
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
                      <span
                        className={cn(
                          "hidden sm:inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                          PRIORITY_COLORS[wo.priority] ?? "bg-muted text-muted-foreground"
                        )}
                      >
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
              <div className="px-4 py-5 text-sm text-muted-foreground">
                Sin incidentes{buScoped ? " en tu unidad" : ""}
              </div>
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
                      {group.assetCode && <p className="text-xs text-muted-foreground">{group.assetCode}</p>}
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

        {/* Modules */}
        <div className="pt-4 border-t border-border/40">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Módulos</p>
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
