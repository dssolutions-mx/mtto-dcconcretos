"use client"

import { useState, useEffect } from "react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Truck, WifiOff } from "lucide-react"
import { ChecklistExecution } from "@/components/checklists/checklist-execution"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { UnifiedOfflineStatus } from "@/components/offline/unified-offline-status"
import { OfflinePrepareBanner } from "@/components/offline/offline-prepare-banner"
import { OfflineChecklistList } from "@/components/checklists/offline-checklist-list"
import { DaySummarySection } from "./day-summary-section"
import { QuickActionsSection } from "./quick-actions-section"
import { UnresolvedIssuesWidget } from "./unresolved-issues-widget"
import { AssetGridView } from "./asset-grid-view"
import { useChecklistSchedules } from "@/hooks/useChecklists"
import { offlineClient } from "@/lib/offline/offline-client"
import { useConnectivity } from "@/lib/offline/use-connectivity"
import { toast } from "sonner"

export function ChecklistDashboard() {
  const { profile, ui } = useAuthZustand()
  const { schedules, fetchSchedules } = useChecklistSchedules()
  const [preparingOffline, setPreparingOffline] = useState(false)
  const [cachedOfflineCount, setCachedOfflineCount] = useState(0)
  const [offlineExecutingId, setOfflineExecutingId] = useState<string | null>(null)
  const connectivity = useConnectivity()
  const isOnline = connectivity === "offline" ? false : connectivity === "online" || connectivity === "degraded" ? true : undefined
  const [stats, setStats] = useState({
    daily: { total: 0, pending: 0, overdue: 0 },
    weekly: { total: 0, pending: 0, overdue: 0 },
    monthly: { total: 0, pending: 0, overdue: 0 },
    templates: 0,
    preventive: { total: 0, pending: 0, overdue: 0 },
  })

  const isOperator = profile?.role && ["OPERADOR", "DOSIFICADOR"].includes(profile.role)
  const canCreateChecklists = ui?.canShowCreateButton("checklists") ?? false
  const canScheduleChecklists = ui?.canShowEditButton("checklists") ?? false

  useEffect(() => {
    fetchSchedules("pendiente")
  }, [fetchSchedules])

  useEffect(() => {
    if (isOnline !== false) {
      void offlineClient.getCachedTemplateCount().then(setCachedOfflineCount)
    }
  }, [isOnline, preparingOffline])

  useEffect(() => {
    if (schedules.length > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const dailyItems = schedules.filter((s) => s.checklists?.frequency === "diario")
      const weeklyItems = schedules.filter((s) => s.checklists?.frequency === "semanal")
      const monthlyItems = schedules.filter((s) => s.checklists?.frequency === "mensual")
      const preventiveItems = schedules.filter((s) => (s as { maintenance_plan_id?: string }).maintenance_plan_id)

      const todaysDaily = dailyItems.filter((s) => {
        const d = new Date((s as { scheduled_day?: string }).scheduled_day || s.scheduled_date)
        d.setHours(0, 0, 0, 0)
        return d >= today && d < tomorrow
      }).length
      const todaysWeekly = weeklyItems.filter((s) => {
        const d = new Date((s as { scheduled_day?: string }).scheduled_day || s.scheduled_date)
        d.setHours(0, 0, 0, 0)
        return d >= today && d < tomorrow
      }).length
      const todaysMonthly = monthlyItems.filter((s) => {
        const d = new Date((s as { scheduled_day?: string }).scheduled_day || s.scheduled_date)
        d.setHours(0, 0, 0, 0)
        return d >= today && d < tomorrow
      }).length

      const overdueDaily = dailyItems.filter(
        (s) => new Date((s as { scheduled_day?: string }).scheduled_day || s.scheduled_date) < today
      ).length
      const overdueWeekly = weeklyItems.filter(
        (s) => new Date((s as { scheduled_day?: string }).scheduled_day || s.scheduled_date) < today
      ).length
      const overdueMonthly = monthlyItems.filter(
        (s) => new Date((s as { scheduled_day?: string }).scheduled_day || s.scheduled_date) < today
      ).length
      const overduePreventive = preventiveItems.filter(
        (s) => new Date((s as { scheduled_day?: string }).scheduled_day || s.scheduled_date) < today
      ).length
      const pendingPreventive = preventiveItems.filter((s) => s.status === "pendiente").length

      setStats({
        daily: { total: todaysDaily, pending: todaysDaily, overdue: overdueDaily },
        weekly: { total: todaysWeekly, pending: todaysWeekly, overdue: overdueWeekly },
        monthly: { total: todaysMonthly, pending: todaysMonthly, overdue: overdueMonthly },
        templates: 0,
        preventive: {
          total: preventiveItems.length,
          pending: pendingPreventive,
          overdue: overduePreventive,
        },
      })
    }
  }, [schedules])

  const handlePrepareOffline = async () => {
    try {
      setPreparingOffline(true)
      let cached = 0

      cached = await offlineClient.prepareOfflineChecklists()
      const shellCached = await offlineClient.precacheOfflineShell()
      setCachedOfflineCount(await offlineClient.getCachedTemplateCount())

      toast.success(`Preparado para uso offline: ${cached} checklists descargados`)
      if (cached === 0) {
        toast.warning("No se descargaron checklists. Verifique su conexión e intente de nuevo.")
      }
      if (!shellCached && process.env.NODE_ENV === "production") {
        toast.warning(
          "Las páginas offline no se guardaron en caché. Recargue la app una vez con conexión."
        )
      }
    } catch (err: unknown) {
      toast.error(`Error al preparar modo offline: ${err instanceof Error ? err.message : "Error desconocido"}`)
    } finally {
      setPreparingOffline(false)
    }
  }

  const handleSyncComplete = () => {
    fetchSchedules("pendiente")
  }

  const offlineNotice = (
    <Card className="mb-6 border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
            Modo Offline — Mostrando datos en caché limitados
          </span>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <DashboardShell>
      <div className="checklist-module font-sans">
        <div className="mb-6">
          <DashboardHeader
            heading={isOperator ? "Mis Checklists" : "Checklists de Mantenimiento"}
            text={
              isOperator
                ? "Ejecuta los checklists asignados a tus activos."
                : "Identifica qué activos necesitan atención y ejecuta los checklists pendientes."
            }
            id="checklists-header"
          />
          {isOperator && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                Operador
              </Badge>
              <span className="text-sm text-muted-foreground">Solo checklists de tus activos asignados</span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
            <div className="flex flex-wrap gap-2">
              <QuickActionsSection
                canScheduleChecklists={canScheduleChecklists}
                canCreateChecklists={canCreateChecklists}
                onPrepareOffline={handlePrepareOffline}
                preparingOffline={preparingOffline}
                isOnline={isOnline}
              />
            </div>
            <div className="hidden sm:block">
              <UnifiedOfflineStatus onSyncComplete={handleSyncComplete} />
            </div>
            <div className="sm:hidden">
              <UnifiedOfflineStatus showDetails={false} onSyncComplete={handleSyncComplete} />
            </div>
          </div>
        </div>

        {isOnline !== false && (
          <OfflinePrepareBanner
            onPrepare={handlePrepareOffline}
            preparing={preparingOffline}
            cachedCount={cachedOfflineCount}
          />
        )}

        {isOnline === false && (
          <Card className="mb-6 border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <WifiOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200">Modo offline activo</p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Solo puede abrir checklists que descargó antes con &quot;Preparar offline&quot;.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isOnline === false && offlineExecutingId ? (
          <div className="mt-6 space-y-4">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setOfflineExecutingId(null)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a la lista offline
            </Button>
            <ChecklistExecution id={offlineExecutingId} />
          </div>
        ) : isOnline === false ? (
          <OfflineChecklistList onOpenChecklist={setOfflineExecutingId} />
        ) : (
          <div className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3">
                <DaySummarySection stats={stats} />
              </div>
              <div>
                <UnresolvedIssuesWidget />
              </div>
            </div>
            <section aria-labelledby="assets-filter-heading">
              <h2 id="assets-filter-heading" className="sr-only">
                Buscar y filtrar activos
              </h2>
              <AssetGridView isOffline={false} offlineNotice={offlineNotice} />
            </section>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
