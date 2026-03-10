"use client"

import { useState, useEffect } from "react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Truck, WifiOff } from "lucide-react"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { OfflineStatus } from "@/components/checklists/offline-status"
import { OfflineChecklistList } from "@/components/checklists/offline-checklist-list"
import { DaySummarySection } from "./day-summary-section"
import { QuickActionsSection } from "./quick-actions-section"
import { UnresolvedIssuesWidget } from "./unresolved-issues-widget"
import { AssetGridView } from "./asset-grid-view"
import { useChecklistSchedules } from "@/hooks/useChecklists"
import { toast } from "sonner"

export function ChecklistDashboard() {
  const { profile, ui } = useAuthZustand()
  const { schedules, fetchSchedules } = useChecklistSchedules()
  const [preparingOffline, setPreparingOffline] = useState(false)
  const [isOnline, setIsOnline] = useState<boolean | undefined>(undefined)
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
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine)
      const on = () => setIsOnline(true)
      const off = () => setIsOnline(false)
      window.addEventListener("online", on)
      window.addEventListener("offline", off)
      return () => {
        window.removeEventListener("online", on)
        window.removeEventListener("offline", off)
      }
    }
  }, [])

  useEffect(() => {
    fetchSchedules("pendiente")
  }, [fetchSchedules])

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
      const mod = await import("@/lib/services/offline-checklist-service")
      const svc = mod.offlineChecklistService
      setPreparingOffline(true)
      const cached = await svc.massiveCachePreparation()
      toast.success(`Preparado para uso offline: ${cached} checklists descargados`)
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
              <OfflineStatus onSyncComplete={handleSyncComplete} />
            </div>
            <div className="sm:hidden">
              <OfflineStatus showDetails={false} onSyncComplete={handleSyncComplete} />
            </div>
          </div>
        </div>

        {isOnline === false && (
          <Card className="mb-6 border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <WifiOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200">Modo Offline Activo</p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Solo puedes acceder a checklists visitados previamente con conexión.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isOnline === false ? (
          <OfflineChecklistList />
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
