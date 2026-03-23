"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  FileText,
  Fuel,
  Loader2,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
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
  maintenance_plan_id?: string | null
  asset?: { id: string; name: string; asset_id: string; plant_id?: string | null } | null
}

interface IngresosGastosPlant {
  plant_id: string
  volumen_concreto: number
  ventas_total: number
  diesel_total: number
  diesel_unitario: number
  mantto_total: number
  mantto_unitario: number
  ebitda: number
  ebitda_pct: number
}

interface EfficiencyMetrics {
  volumen: number
  ventas: number
  dieselUnitario: number
  dieselTotal: number
  manttoUnitario: number
  manttoTotal: number
  ebitda: number
  ebitdaPct: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Preventive work order types used in the DB */
const isPreventive = (type: string | null | undefined) => {
  const lc = (type ?? "").toLowerCase()
  return lc.includes("prev")
}

/** Terminal statuses — preventive WOs with these are "done" */
const isDone = (status: string | null | undefined) => {
  const lc = (status ?? "").toLowerCase()
  return lc === "completada" || lc === "completed" || lc === "cancelada" || lc === "cancelled"
}

function formatCurrency(value: number): string {
  return value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  })
}

function aggregatePlants(plants: IngresosGastosPlant[]): EfficiencyMetrics {
  const volumen = plants.reduce((s, p) => s + (p.volumen_concreto ?? 0), 0)
  const ventas = plants.reduce((s, p) => s + (p.ventas_total ?? 0), 0)
  const dieselTotal = plants.reduce((s, p) => s + (p.diesel_total ?? 0), 0)
  const manttoTotal = plants.reduce((s, p) => s + (p.mantto_total ?? 0), 0)
  const ebitda = plants.reduce((s, p) => s + (p.ebitda ?? 0), 0)
  return {
    volumen,
    ventas,
    dieselUnitario: volumen > 0 ? dieselTotal / volumen : 0,
    dieselTotal,
    manttoUnitario: volumen > 0 ? manttoTotal / volumen : 0,
    manttoTotal,
    ebitda,
    ebitdaPct: ventas > 0 ? (ebitda / ventas) * 100 : 0,
  }
}

// ─── Efficiency card ──────────────────────────────────────────────────────────

function EffCard({
  label,
  value,
  sub,
  accent,
  prevRaw,
  invertTrend = false,
  href,
}: {
  label: string
  value: string
  sub?: string
  accent: string
  /** Previous month raw numeric (same unit as value for delta calc) */
  prevRaw?: number
  /** true = lower is better (cost metrics) */
  invertTrend?: boolean
  href?: string
}) {
  const currNum = parseFloat(value.replace(/[^0-9.-]/g, "")) || 0
  const delta = prevRaw !== undefined && prevRaw !== 0
    ? ((currNum - prevRaw) / Math.abs(prevRaw)) * 100
    : null
  const isGood = delta === null ? null : invertTrend ? delta < 0 : delta > 0

  const inner = (
    <div className={cn(
      "group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card",
      "px-4 py-3.5 transition-all hover:border-border hover:shadow-sm"
    )}>
      <div className={cn("absolute inset-x-0 top-0 h-[3px] rounded-t-2xl", accent)} />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <p
        className="mt-1.5 font-bold leading-none tabular-num text-foreground"
        style={{ fontSize: "clamp(1.25rem, 4vw, 1.75rem)" }}
      >
        {value}
      </p>
      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
        {sub && <p className="text-[10px] text-muted-foreground/60 truncate">{sub}</p>}
        {delta !== null && (
          <span className={cn(
            "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none",
            isGood === true ? "bg-green-50 text-green-700 border border-green-200"
            : isGood === false ? "bg-amber-50 text-amber-700 border border-amber-200"
            : "bg-muted text-muted-foreground"
          )}>
            {delta > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
  if (href) return <Link href={href} className="block">{inner}</Link>
  return inner
}

function EffCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border/40 bg-card px-4 py-3.5">
      <div className="h-2 w-20 rounded bg-muted/50" />
      <div className="mt-2.5 h-7 w-16 rounded bg-muted/60" />
      <div className="mt-1.5 h-2 w-14 rounded bg-muted/40" />
    </div>
  )
}

// ─── Quick actions card ────────────────────────────────────────────────────────

function QuickActionsCard() {
  const actions = [
    {
      icon: AlertTriangle,
      title: "Registrar incidencia",
      sub: "Notificar anomalía o falla",
      href: "/incidentes",
    },
    {
      icon: Users,
      title: "Asignación personal → activo",
      sub: "Registrar <24h · Notificar a RH",
      href: "/organizacion/asignacion-activos",
    },
    {
      icon: FileText,
      title: "Solicitar alta de usuario RH",
      sub: "Gestión de accesos en plataforma",
      href: "/gestion/personal",
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
      <div className="border-b border-border/50 px-4 py-3 sm:px-5">
        <span className="text-sm font-semibold">Acciones de tu rol</span>
      </div>
      <div className="divide-y divide-border/40">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60 sm:px-5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
                <Icon className="h-3.5 w-3.5 text-foreground/70" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{a.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{a.sub}</p>
              </div>
              <svg className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6"/></svg>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JUNDashboard() {
  const { profile, ui, isLoading: authLoading, isInitialized, isAuthenticated } = useAuthZustand()
  const router = useRouter()

  const [plantCount, setPlantCount] = useState(0)
  const [preventivePending, setPreventivePending] = useState(0)
  const [dataLoading, setDataLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [effData, setEffData] = useState<EfficiencyMetrics | null>(null)
  const [effPrev, setEffPrev] = useState<EfficiencyMetrics | null>(null)
  const [effLoading, setEffLoading] = useState(true)

  // Role guard
  useEffect(() => {
    if (!isInitialized || authLoading) return
    if (!isAuthenticated || !profile) { router.push("/login"); return }
    if (profile.role !== "JEFE_UNIDAD_NEGOCIO") router.push("/dashboard")
  }, [isInitialized, authLoading, isAuthenticated, profile, router])

  const loadData = useCallback(async () => {
    if (profile?.role !== "JEFE_UNIDAD_NEGOCIO") return
    try {
      setDataLoading(true)
      setEffLoading(true)
      const buId = profile.business_unit_id ?? null
      const month = new Date().toISOString().slice(0, 7)

      const [plantsRes, woRes, effRes] = await Promise.all([
        fetch("/api/plants", { credentials: "include", cache: "no-store" }),
        fetch("/api/work-orders/list", { credentials: "include", cache: "no-store" }),
        fetch("/api/reports/gerencial/ingresos-gastos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, businessUnitId: buId, plantId: null }),
          credentials: "include",
          cache: "no-store",
        }),
      ])

      // Plants in this BU
      let plantSet = new Set<string>()
      if (plantsRes.ok && buId) {
        const j = await plantsRes.json()
        const plants: Array<{ id: string; business_unit_id?: string | null }> = j.plants ?? []
        plantSet = new Set(plants.filter((p) => p.business_unit_id === buId).map((p) => p.id))
        setPlantCount(plantSet.size)
      }

      // Preventive WOs not completed, scoped to this BU's plants
      if (woRes.ok) {
        const j = await woRes.json()
        const allWOs: WorkOrder[] = j.workOrders ?? []
        const pending = allWOs.filter((wo) => {
          if (!isPreventive(wo.type) && !wo.maintenance_plan_id) return false
          if (isDone(wo.status)) return false
          if (buId && plantSet.size > 0) {
            return !!wo.asset?.plant_id && plantSet.has(wo.asset.plant_id)
          }
          return buId === null // no BU filter → show all
        })
        setPreventivePending(pending.length)
      }

      // Efficiency
      if (effRes.ok) {
        const j = await effRes.json()
        setEffData(aggregatePlants(j.plants ?? []))
        setEffPrev(aggregatePlants(j.comparison?.plants ?? []))
      }
    } catch (err) {
      console.error("[JUNDashboard]", err)
    } finally {
      setDataLoading(false)
      setEffLoading(false)
    }
  }, [profile?.role, profile?.business_unit_id])

  useEffect(() => {
    if (isInitialized && !authLoading && profile?.role === "JEFE_UNIDAD_NEGOCIO") void loadData()
  }, [isInitialized, authLoading, profile?.role, loadData])

  const handleRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false) }

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

  if (!isInitialized || authLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!isAuthenticated || !profile || profile.role !== "JEFE_UNIDAD_NEGOCIO") return null

  const buName = profile.business_units?.name ?? null
  const roleSubtitle = ["Jefe de Unidad de Negocio", buName, plantCount > 0 ? `${plantCount} ${plantCount === 1 ? "planta" : "plantas"}` : null]
    .filter(Boolean).join(" · ")

  const monthLabel = new Date().toLocaleString("es-MX", { month: "long", year: "numeric" })

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={refreshing}>

      {!profile.business_unit_id && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tu perfil no tiene unidad de negocio asignada. Los datos pueden estar incompletos.
          </p>
        </div>
      )}

      <DashboardExecutiveLayout
        hero={<DashboardExecutiveHero name={`${profile.nombre} ${profile.apellido}`} role={roleSubtitle} />}
        userName={`${profile.nombre} ${profile.apellido}`}
        userRole={roleSubtitle}
        actions={
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}
            className="h-8 w-8 p-0 sm:w-auto sm:px-3" aria-label="Actualizar"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline ml-1.5 text-xs">Actualizar</span>
          </Button>
        }
        shortcuts={[
          { label: "Preventivos pendientes", href: "/ordenes", icon: <Wrench className="h-4 w-4" /> },
          { label: "Cumplimiento checklist/diésel", href: "/compliance", icon: <ClipboardList className="h-4 w-4" /> },
        ]}
        kpis={
          <div className="space-y-6">

            {/* ── Operational hero ─────────────────────────────────────── */}
            <DashboardActionStrip
              icon={Wrench}
              count={dataLoading ? 0 : preventivePending}
              label="preventivos pendientes en tu unidad"
              href="/ordenes"
              ctaLabel="Ver órdenes"
            />

            {/* ── Efficiency metrics ───────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Eficiencia · {monthLabel}
                </p>
                <Link href="/reportes/gerencial/ingresos-gastos"
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  Ver reporte →
                </Link>
              </div>

              {effLoading ? (
                <div className="grid grid-cols-3 gap-2.5">
                  <EffCardSkeleton />
                  <EffCardSkeleton />
                  <EffCardSkeleton />
                </div>
              ) : effData ? (
                <div className="grid grid-cols-3 gap-2.5">
                  <EffCard
                    label="EBITDA"
                    value={`${effData.ebitdaPct.toFixed(1)}%`}
                    sub={effData.volumen > 0 ? `${effData.volumen.toLocaleString("es-MX", { maximumFractionDigits: 0 })} m³` : undefined}
                    accent={
                      effData.ebitdaPct >= 15 ? "bg-gradient-to-r from-green-400 to-emerald-300"
                      : effData.ebitdaPct >= 5 ? "bg-gradient-to-r from-amber-400 to-yellow-300"
                      : "bg-gradient-to-r from-red-400 to-rose-300"
                    }
                    prevRaw={effPrev?.ebitdaPct}
                    invertTrend={false}
                    href="/reportes/gerencial/ingresos-gastos"
                  />
                  <EffCard
                    label="Diésel/m³"
                    value={formatCurrency(effData.dieselUnitario)}
                    sub={formatCurrency(effData.dieselTotal)}
                    accent="bg-gradient-to-r from-orange-400 to-amber-300"
                    prevRaw={effPrev?.dieselUnitario}
                    invertTrend={true}
                    href="/diesel"
                  />
                  <EffCard
                    label="Mtto/m³"
                    value={formatCurrency(effData.manttoUnitario)}
                    sub={formatCurrency(effData.manttoTotal)}
                    accent="bg-gradient-to-r from-violet-400 to-purple-300"
                    prevRaw={effPrev?.manttoUnitario}
                    invertTrend={true}
                    href="/reportes/gerencial/ingresos-gastos"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground px-1">Sin datos de eficiencia para este mes.</p>
              )}
            </div>

            {/* ── Role quick-actions ───────────────────────────────────── */}
            <QuickActionsCard />

          </div>
        }
        modules={
          <DashboardModuleLinks
            modules={moduleCards
              .filter((c) => ui.shouldShowInNavigation(c.module))
              .map((c) => ({ title: c.title, href: c.href, icon: c.icon, hasAccess: true }))}
          />
        }
      />
    </PullToRefresh>
  )
}
