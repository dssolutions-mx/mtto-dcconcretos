"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Fuel,
  Loader2,
  RefreshCw,
  Truck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { DashboardExecutiveLayout } from "@/components/dashboard/dashboard-executive-layout"
import { DashboardExecutiveHero } from "@/components/dashboard/dashboard-executive-hero"
import { DashboardActionStrip } from "@/components/dashboard/dashboard-action-strip"
import { DashboardModuleLinks } from "@/components/dashboard/dashboard-module-links"
import { OperatorReportProblemDialog } from "@/components/operator/operator-report-problem-dialog"
import { cn } from "@/lib/utils"
import type { PlantDailyReadinessPayload } from "@/types/plant-daily-readiness"

export default function DosificadorDashboard() {
  const { profile, ui, isLoading: authLoading, isInitialized, isAuthenticated } = useAuthZustand()
  const router = useRouter()

  const [payload, setPayload] = useState<PlantDailyReadinessPayload | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    if (!isInitialized || (authLoading && !profile)) return
    if (!isAuthenticated || !profile) {
      router.push("/login")
      return
    }
    if (profile.role !== "DOSIFICADOR") {
      router.push("/dashboard")
    }
  }, [isInitialized, authLoading, isAuthenticated, profile, router])

  const loadData = useCallback(async () => {
    try {
      setDataLoading(true)
      setError(null)
      const res = await fetch("/api/checklists/plant-daily-readiness", {
        credentials: "include",
        cache: "no-store",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      setPayload(json.data as PlantDailyReadinessPayload)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos")
      setPayload(null)
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isInitialized && profile?.role === "DOSIFICADOR") {
      void loadData()
    }
  }, [isInitialized, profile?.role, loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const reporterDisplayName = useMemo(() => {
    if (!profile) return ""
    return `${profile.nombre || ""} ${profile.apellido || ""}`.trim()
  }, [profile])

  const assignedForReport = useMemo(
    () =>
      (payload?.assetsForIncidents ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        asset_id: a.asset_id,
      })),
    [payload?.assetsForIncidents]
  )

  const moduleCards = [
    { title: "Diésel", href: "/diesel", icon: Fuel, module: "inventory" as const },
    { title: "Checklists", href: "/checklists", icon: ClipboardList, module: "checklists" as const },
  ]

  if (!isInitialized || (authLoading && !profile)) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated || !profile || profile.role !== "DOSIFICADOR") {
    return null
  }

  const plantName = profile.plants?.name ?? null
  const roleSubtitle = ["Dosificador", plantName].filter(Boolean).join(" · ")
  const userLabel = `${profile.nombre} ${profile.apellido}`

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={refreshing}>
      <OperatorReportProblemDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        assignedAssets={assignedForReport}
        reporterDisplayName={reporterDisplayName}
        onSuccess={() => {
          void loadData()
        }}
      />

      <DashboardExecutiveLayout
        hero={
          <div id="dashboard-header">
            <DashboardExecutiveHero name={userLabel} role={roleSubtitle} />
          </div>
        }
        userName={userLabel}
        userRole={roleSubtitle}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || dataLoading}
            className="h-8 w-8 p-0 sm:w-auto sm:px-3"
            aria-label="Actualizar"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline ml-1.5 text-xs">Actualizar</span>
          </Button>
        }
        shortcuts={[
          { label: "Diésel", href: "/diesel", icon: <Fuel className="h-4 w-4" /> },
          { label: "Checklists", href: "/checklists", icon: <ClipboardList className="h-4 w-4" /> },
          {
            label: "Incidentes del equipo",
            href: "/dashboard/operator/incidentes?estado=abiertos",
            icon: <AlertTriangle className="h-4 w-4" />,
          },
        ]}
        kpis={
          <div className="space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Inspección diaria en planta
            </p>

            <DashboardActionStrip
              icon={ClipboardList}
              count={dataLoading ? 0 : (payload?.pendingCount ?? 0)}
              label="activos con inspección diaria pendiente"
              href="#inspeccion-diaria"
              ctaLabel="Ver listado"
            />

            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="min-h-[48px] gap-2" asChild>
                <Link href="/diesel">
                  <Fuel className="h-5 w-5" />
                  Registrar / ver diésel
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="min-h-[48px] gap-2" asChild>
                <Link href="/checklists">
                  <ClipboardList className="h-5 w-5" />
                  Checklists
                </Link>
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="min-h-[48px] gap-2 border-amber-200 text-amber-900 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-950/40"
                onClick={() => setReportOpen(true)}
              >
                <AlertTriangle className="h-5 w-5" />
                Reportar problema
              </Button>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div id="inspeccion-diaria" className="scroll-mt-24">
              <PlantDailyTable loading={dataLoading} payload={payload} />
            </div>
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

function PlantDailyTable({
  loading,
  payload,
}: {
  loading: boolean
  payload: PlantDailyReadinessPayload | null
}) {
  const rows = payload?.rows ?? []

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
        <div className="border-b border-border/50 px-4 py-3 sm:px-5">
          <div className="h-4 w-48 animate-pulse rounded bg-muted/60" />
        </div>
        <div className="divide-y divide-border/40">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4 px-4 py-4 sm:px-5">
              <div className="h-10 flex-1 animate-pulse rounded bg-muted/50" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card px-4 py-6 sm:px-5">
        <p className="text-sm text-muted-foreground">
          No hay programaciones de checklist <strong>diario</strong> para hoy en tu planta, o aún no hay
          activos operativos con inspección diaria pendiente o vencida registrada.
        </p>
        {payload?.todayKey && (
          <p className="mt-2 text-xs text-muted-foreground/80">Fecha (UTC): {payload.todayKey}</p>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 min-w-0">
          <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold truncate">Activos · inspección diaria</span>
          <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-background tabular-num min-w-[22px]">
            {rows.length}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground sm:text-xs">
          No cargar unidad si la inspección diaria no está completada.
        </p>
      </div>

      <div className="divide-y divide-border/40">
        {rows.map((row, idx) => {
          const ok = row.readiness === "listo"
          return (
            <div
              key={row.assetId}
              className={cn(
                "grid gap-3 px-4 py-3 sm:px-5 sm:grid-cols-[auto_1fr_auto] sm:items-center",
                !ok && "bg-amber-50/50 dark:bg-amber-950/15"
              )}
            >
              <span className="hidden sm:block text-center text-xs font-medium text-muted-foreground/40 tabular-num">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold tabular-nums">{row.assetCode ?? "—"}</p>
                  {ok ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      Listo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                      <AlertTriangle className="h-3 w-3" />
                      Pendiente
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.assetName ?? "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">Operador:</span>{" "}
                  {row.operatorName ?? "Sin asignar"}
                </p>
                {row.checklistName && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground/90">{row.checklistName}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2">
                {!ok && row.pendingScheduleId ? (
                  <Button asChild size="sm" variant="secondary" className="min-h-[40px]">
                    <Link href={`/checklists/ejecutar/${row.pendingScheduleId}`}>
                      Ejecutar
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline" className="min-h-[40px]">
                    <Link href={`/checklists/assets/${row.assetId}`}>
                      Ver
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
