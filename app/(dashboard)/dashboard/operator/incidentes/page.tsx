"use client"

import { useEffect, useState, useCallback, useMemo, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Loader2, RefreshCw, ChevronRight, CheckCircle2, ArrowLeft, Inbox } from "lucide-react"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import type { OperatorIncidentsApiResponse, OperatorIncidentItem } from "@/types/operator-incidents"
import {
  workOrderStatusLabelForOperator,
  friendlyIncidentTypeLabel,
  operatorIncidentSecondaryLine,
} from "@/lib/operator-incident-ui"
import { operatorIncidentHasProgress } from "@/lib/operator-incident-procurement"
import { cn } from "@/lib/utils"
import { dashboardHomeForRole } from "@/lib/dashboard-home"

type EstadoTab = "abiertos" | "cerrados"

function buildDetailHref(id: string, asset: string | null, estado: EstadoTab) {
  const q = new URLSearchParams()
  if (asset) q.set("asset", asset)
  q.set("estado", estado)
  const s = q.toString()
  return s ? `/dashboard/operator/incidentes/${id}?${s}` : `/dashboard/operator/incidentes/${id}`
}

function IncidentesListContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const assetFilter = searchParams.get("asset")
  const estado: EstadoTab = searchParams.get("estado") === "cerrados" ? "cerrados" : "abiertos"

  const { profile, isInitialized, isAuthenticated, isLoading: authLoading } = useAuthZustand()
  const [data, setData] = useState<OperatorIncidentsApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!isInitialized || (authLoading && !profile)) return
    if (!isAuthenticated || !profile) {
      router.push("/login")
      return
    }
    if (!["OPERADOR", "DOSIFICADOR"].includes(profile.role)) {
      router.push("/dashboard")
    }
  }, [isInitialized, authLoading, isAuthenticated, profile, router])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/operator/incidents", { credentials: "include", cache: "no-store" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      setData((await res.json()) as OperatorIncidentsApiResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (profile && ["OPERADOR", "DOSIFICADOR"].includes(profile.role)) load()
  }, [profile, load])

  const handleRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const onEstadoChange = (value: string) => {
    const next: EstadoTab = value === "cerrados" ? "cerrados" : "abiertos"
    const q = new URLSearchParams(searchParams.toString())
    if (next === "abiertos") q.delete("estado")
    else q.set("estado", "cerrados")
    const qs = q.toString()
    router.replace(qs ? `/dashboard/operator/incidentes?${qs}` : "/dashboard/operator/incidentes", {
      scroll: false,
    })
  }

  const clearAssetHref = useMemo(() => {
    const q = new URLSearchParams()
    if (estado === "cerrados") q.set("estado", "cerrados")
    const s = q.toString()
    return s ? `/dashboard/operator/incidentes?${s}` : "/dashboard/operator/incidentes"
  }, [estado])

  const flatIncidents: OperatorIncidentItem[] = useMemo(() => {
    if (!data?.assets) return []
    const rows = data.assets.flatMap((g) => g.incidents)
    if (!assetFilter) return rows
    return rows.filter((i) => i.asset_uuid === assetFilter)
  }, [data, assetFilter])

  const sorted = useMemo(
    () => [...flatIncidents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [flatIncidents]
  )

  const filtered = useMemo(() => {
    if (estado === "abiertos") return sorted.filter((i) => i.is_open)
    return sorted.filter((i) => !i.is_open)
  }, [sorted, estado])

  if (!profile || !["OPERADOR", "DOSIFICADOR"].includes(profile.role)) {
    return null
  }

  const panelHomeHref = dashboardHomeForRole(profile.role)

  const hasScopeData = !loading && data && (data.assets?.length ?? 0) > 0
  const noIncidentsForScope = hasScopeData && flatIncidents.length === 0
  const filterEmpty = hasScopeData && flatIncidents.length > 0 && filtered.length === 0

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={refreshing}>
      <DashboardShell className="space-y-4">
        <DashboardHeader
          heading="Incidentes del equipo"
          text="Problemas registrados en tus activos asignados (tuyos y del equipo). Estado de la orden de trabajo."
        >
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" asChild className="gap-1 px-2 sm:px-3">
              <Link href={panelHomeHref}>
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Panel</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </DashboardHeader>

        {assetFilter && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={clearAssetHref}>Quitar filtro de activo</Link>
            </Button>
          </div>
        )}

        {!loading && hasScopeData && (
          <Tabs value={estado} onValueChange={onEstadoChange} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="abiertos">Abiertos / pendientes</TabsTrigger>
              <TabsTrigger value="cerrados">Cerrados / resueltos</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && data && data.assets.length === 0 && (
          <Alert>
            <AlertDescription>
              No tienes activos asignados, o aún no hay incidentes en el sistema para tu alcance.
            </AlertDescription>
          </Alert>
        )}

        {!loading && noIncidentsForScope && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">
              {assetFilter ? "Sin incidentes para este activo" : "Sin incidentes en tu equipo"}
            </p>
            <p className="text-sm text-muted-foreground">
              Cuando existan registros para tus activos, aparecerán aquí.
            </p>
            <Button asChild>
              <Link href={panelHomeHref}>Volver al panel</Link>
            </Button>
          </div>
        )}

        {!loading && filterEmpty && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="font-semibold">
              {estado === "abiertos"
                ? "No hay incidentes abiertos con este filtro"
                : "No hay incidentes cerrados o resueltos con este filtro"}
            </p>
            <p className="text-sm text-muted-foreground">
              {estado === "abiertos"
                ? "Prueba la pestaña «Cerrados / resueltos» o quita el filtro de activo."
                : "Prueba la pestaña «Abiertos / pendientes»."}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border/80 bg-card">
            {filtered.map((inc) => {
              const st = (inc.status || "").toLowerCase()
              const hasProgress =
                inc.is_open &&
                !!inc.work_order &&
                operatorIncidentHasProgress({
                  planned_date: inc.work_order.planned_date,
                  parts: inc.work_order.parts_procurement,
                })
              const dot =
                st.includes("resuelto") || st.includes("cerrado")
                  ? "bg-emerald-500"
                  : hasProgress || st.includes("progreso")
                    ? "bg-blue-500"
                    : "bg-amber-500"
              const secondary = operatorIncidentSecondaryLine(inc.work_order)
              return (
                <Link
                  key={inc.id}
                  href={buildDetailHref(inc.id, assetFilter, estado)}
                  className="flex min-h-[64px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60"
                >
                  <span className={cn("h-3 w-3 shrink-0 rounded-full", dot)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-muted-foreground">{inc.asset_code}</p>
                    <p className="truncate text-sm font-medium">{inc.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {friendlyIncidentTypeLabel(inc.type)}
                      {inc.reported_by ? ` · Reporte: ${inc.reported_by}` : ""}
                    </p>
                    {secondary && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground/90">{secondary}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="max-w-[140px] shrink-0 truncate text-[10px]">
                    {inc.work_order?.order_id ?? "Sin OT"} · {workOrderStatusLabelForOperator(inc.work_order)}
                  </Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              )
            })}
          </div>
        )}
      </DashboardShell>
    </PullToRefresh>
  )
}

export default function OperatorIncidentesPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DashboardShell>
      }
    >
      <IncidentesListContent />
    </Suspense>
  )
}
