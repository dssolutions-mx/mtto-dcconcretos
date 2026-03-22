"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
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
import { DashboardExecutiveLayout } from "@/components/dashboard/dashboard-executive-layout"
import { DashboardExecutiveHero } from "@/components/dashboard/dashboard-executive-hero"
import { DashboardActionStrip } from "@/components/dashboard/dashboard-action-strip"

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

// ─── Operational KPI card ─────────────────────────────────────────────────────

function OperationalKpiCard({
  label,
  value,
  icon: Icon,
  accentClass,
  href,
  highlight,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  accentClass: string
  href?: string
  highlight?: boolean
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

      {/* Icon + label */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 sm:h-8 sm:w-8">
          <Icon className="h-3.5 w-3.5 text-foreground/70 sm:h-4 sm:w-4" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight sm:text-[11px] sm:tracking-widest">
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="mt-3 flex-1">
        <p
          className={cn(
            "font-bold leading-none tracking-tight tabular-num",
            highlight && value > 0 ? "text-amber-600" : "text-foreground"
          )}
          style={{ fontSize: "clamp(1.8rem, 6vw, 2.5rem)" }}
        >
          {value}
        </p>
        <p className="mt-1.5 text-[10px] text-muted-foreground/50">
          {value === 0 ? "Sin pendientes" : "En tu unidad"}
        </p>
      </div>
    </div>
  )

  if (href) return <Link href={href} className="block">{inner}</Link>
  return inner
}

function KpiCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border/40 bg-card px-4 py-4 sm:px-6 sm:py-5 min-h-[110px] sm:min-h-[130px]">
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-muted/60" />
        <div className="h-2.5 w-24 rounded bg-muted/50" />
      </div>
      <div className="mt-4 h-10 w-16 rounded bg-muted/60" />
      <div className="mt-2 h-2.5 w-20 rounded bg-muted/40" />
    </div>
  )
}

// ─── Work orders queue ────────────────────────────────────────────────────────

function WorkOrdersQueue({
  workOrders,
  totalCount,
  isLoading,
}: {
  workOrders: WorkOrder[]
  totalCount: number
  isLoading: boolean
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">Órdenes activas en tu unidad</span>
          {!isLoading && totalCount > 0 && (
            <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-background tabular-num min-w-[22px]">
              {totalCount}
            </span>
          )}
        </div>
        {totalCount > 0 && !isLoading && (
          <Link
            href="/ordenes"
            className="shrink-0 ml-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver todas →
          </Link>
        )}
      </div>

      {/* Rows */}
      {isLoading ? (
        <div className="divide-y divide-border/40">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse sm:px-5">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-muted/60" />
                <div className="h-2.5 w-40 rounded bg-muted/40" />
              </div>
              <div className="h-3 w-14 rounded bg-muted/40" />
            </div>
          ))}
        </div>
      ) : workOrders.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5 sm:px-5">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-muted-foreground">Sin órdenes activas · Todo al día</span>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {workOrders.map((wo, idx) => (
            <Link
              key={wo.id}
              href={`/ordenes/${wo.id}`}
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

              {/* Order info */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold tabular-num">{wo.order_id}</span>
                  {wo.type && (
                    <span
                      className={cn(
                        "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                        wo.type.toLowerCase().includes("prev")
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-orange-50 text-orange-700 border border-orange-200"
                      )}
                    >
                      {wo.type}
                    </span>
                  )}
                  {wo.created_at && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      {formatAge(wo.created_at)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {wo.asset?.name ?? wo.description ?? "—"}
                </p>
              </div>

              {/* Priority + chevron */}
              <div className="flex items-center gap-1.5 shrink-0">
                {wo.priority && (
                  <span
                    className={cn(
                      "hidden sm:inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                      wo.priority === "Alta" || wo.priority === "Crítica"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : wo.priority === "Media"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {wo.priority}
                  </span>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
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
        setWorkOrders(scoped.slice(0, 8))
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

  const totalIncidents = incidents.length
  const pendingServicesCount = workOrders.length + totalIncidents

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

  // ─── Loading / auth ───────────────────────────────────────────────────────

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
  const roleSubtitle = [
    "Jefe de Unidad de Negocio",
    buName,
    plantCount > 0 ? `${plantCount} ${plantCount === 1 ? "planta" : "plantas"}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={refreshing}>

      {/* No BU warning — own row above the layout */}
      {!profile.business_unit_id && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tu perfil no tiene unidad de negocio asignada. Los datos mostrados pueden estar incompletos.
          </p>
        </div>
      )}

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
          { label: "Servicios pendientes", href: "/ordenes", icon: <Wrench className="h-4 w-4" /> },
          { label: "Incidentes", href: "/incidentes", icon: <AlertTriangle className="h-4 w-4" /> },
          { label: "Cumplimiento", href: "/compliance", icon: <ClipboardList className="h-4 w-4" /> },
          { label: "Reportes", href: "/reportes", icon: <BarChart3 className="h-4 w-4" /> },
        ]}
        kpis={
          <div className="space-y-5">

            {/* Section label */}
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Resumen de tu unidad
            </p>

            {/* Hero action strip */}
            <DashboardActionStrip
              icon={Wrench}
              count={pendingServicesCount}
              label="servicios activos en tu unidad"
              href="/ordenes"
              ctaLabel="Ver órdenes"
            />

            {/* Operational KPI cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {dataLoading ? (
                <>
                  <KpiCardSkeleton />
                  <KpiCardSkeleton />
                </>
              ) : (
                <>
                  <OperationalKpiCard
                    label="OTs activas"
                    value={workOrders.length}
                    icon={Wrench}
                    accentClass="bg-gradient-to-r from-slate-400 to-slate-300"
                    href="/ordenes"
                  />
                  <OperationalKpiCard
                    label="Incidentes abiertos"
                    value={totalIncidents}
                    icon={AlertTriangle}
                    accentClass="bg-gradient-to-r from-amber-400 to-orange-300"
                    href="/incidentes"
                    highlight
                  />
                </>
              )}
            </div>

            {/* Checklists pending — tertiary stat */}
            {!dataLoading && pendingChecklists > 0 && (
              <Link
                href="/checklists"
                className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ClipboardList className="h-4 w-4" />
                  <span>{pendingChecklists} {pendingChecklists === 1 ? "checklist pendiente" : "checklists pendientes"} en tu unidad</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </Link>
            )}

            {/* Work orders queue */}
            <WorkOrdersQueue
              workOrders={workOrders}
              totalCount={workOrders.length}
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
