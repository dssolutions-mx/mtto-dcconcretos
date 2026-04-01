"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ClipboardList, Fuel, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { DashboardExecutiveLayout } from "@/components/dashboard/dashboard-executive-layout"
import { DashboardExecutiveHero } from "@/components/dashboard/dashboard-executive-hero"
import { DashboardActionStrip } from "@/components/dashboard/dashboard-action-strip"
import { DashboardModuleLinks } from "@/components/dashboard/dashboard-module-links"
import { OperatorReportProblemDialog } from "@/components/operator/operator-report-problem-dialog"
import { PlantDailyReadinessTable } from "@/components/dashboard/plant-daily-readiness-table"
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
              <PlantDailyReadinessTable loading={dataLoading} payload={payload} />
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
