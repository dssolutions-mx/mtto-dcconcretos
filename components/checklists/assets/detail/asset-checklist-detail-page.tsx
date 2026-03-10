"use client"

import { useState, useCallback, use, useEffect } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, ArrowLeft, ClipboardCheck, FileText, Truck } from "lucide-react"
import { toast } from "sonner"
import { OfflineStatus } from "@/components/checklists/offline-status"
import { offlineChecklistService } from "@/lib/services/offline-checklist-service"
import { categorizeSchedulesByDate, getRelativeDateDescription } from "@/lib/utils/date-utils"
import { AssetDetailHeader } from "./asset-detail-header"
import { AssetDetailKpiCard } from "./asset-detail-kpi-card"
import { AssetDetailOfflineBanner } from "./asset-detail-offline-banner"
import { PendientesTab } from "./tabs/pendientes-tab"
import { CompletadosTab } from "./tabs/completados-tab"
import { InformacionTab } from "./tabs/informacion-tab"
import { AssetChecklistDetailSkeleton } from "@/components/ui/skeleton-loader"

const RescheduleChecklistModal = dynamic(
  () =>
    import("@/components/checklists/reschedule-checklist-modal").then(
      (mod) => mod.RescheduleChecklistModal
    ),
  { ssr: false }
)

interface Asset {
  id: string
  name: string
  asset_id: string
  location: string | null
  department: string | null
  status: string
  current_hours: number | null
  plants?: { name: string } | null
  departments?: { name: string } | null
}

interface ChecklistSchedule {
  id: string
  template_id: string
  asset_id: string
  scheduled_date: string
  status: string
  assigned_to: string | null
  checklists: { id: string; name: string; frequency: string; description?: string | null } | null
  profiles: { nombre: string | null; apellido: string | null } | null
}

interface CompletedChecklist {
  id: string
  asset_id: string
  updated_at: string
  completion_date?: string
  technician?: string
  completed_items?: Array<{ id: string; status: string }>
  checklists: { id: string; name: string; frequency: string } | null
  profiles: { nombre: string | null; apellido: string | null } | null
}

function formatDate(dateString: string) {
  const datePart = dateString.split("T")[0]
  const [year, month, day] = datePart.split("-").map(Number)
  const dateOnly = new Date(year, month - 1, day)
  return dateOnly.toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function AssetChecklistDetailPage({
  params,
  isOnline,
}: {
  params: Promise<{ id: string }>
  isOnline?: boolean
}) {
  const resolvedParams = use(params)
  const assetId = resolvedParams.id
  const router = useRouter()

  const [rescheduleId, setRescheduleId] = useState<string | null>(null)

  const fetcher = useCallback(
    async (url: string) => {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          if (!navigator.onLine) throw new Error("Offline mode")
          throw new Error(`API error: ${res.status}`)
        }
        const json = await res.json()
        if (json?.data?.asset) {
          try {
            await offlineChecklistService.cacheAssetData(assetId, json.data.asset)
          } catch {
            /* non-fatal */
          }
        }
        return json
      } catch (err) {
        if (!navigator.onLine) {
          const cachedAsset = await offlineChecklistService.getCachedAssetData(assetId)
          if (cachedAsset) {
            const cachedSchedules =
              await offlineChecklistService.getCachedChecklistSchedules("pendiente")
            const assetSchedules = (cachedSchedules || []).filter(
              (s: { asset_id: string }) => s.asset_id === assetId
            )
            toast.success("Modo offline activado - funcionalidad limitada")
            return {
              data: {
                asset: cachedAsset,
                pending_schedules: { all: assetSchedules },
                completed_checklists: [],
              },
            }
          }
          throw new Error("No hay datos en caché para este activo")
        }
        throw err
      }
    },
    [assetId]
  )

  const { data, error, isLoading, mutate } = useSWR(
    assetId ? `/api/assets/${assetId}/dashboard` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const asset = data?.data?.asset ?? null
  const pendingSchedules = data?.data?.pending_schedules?.all ?? []
  const completedChecklists = data?.data?.completed_checklists ?? []
  const loading = isLoading

  useEffect(() => {
    if (error) toast.error("Error al cargar los datos del activo")
  }, [error])

  const handleRescheduled = useCallback(() => {
    mutate()
  }, [mutate])

  const handleSyncComplete = useCallback(() => {
    mutate()
  }, [mutate])

  if (loading) {
    return (
      <DashboardShell>
        <div className="checklist-module space-y-4">
          <AssetChecklistDetailSkeleton />
        </div>
      </DashboardShell>
    )
  }

  const errorMessage = error instanceof Error ? error.message : error ? String(error) : null

  if (errorMessage || (!loading && !asset)) {
    return (
      <DashboardShell>
        <div className="checklist-module space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Error</h1>
              <p className="text-sm text-muted-foreground">
                No se pudo cargar la información del activo
              </p>
            </div>
            <Button variant="outline" onClick={() => router.back()} className="cursor-pointer">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </div>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{errorMessage || "Activo no encontrado"}</AlertDescription>
          </Alert>
        </div>
      </DashboardShell>
    )
  }

  const { overdue, today, upcoming, future } = categorizeSchedulesByDate(pendingSchedules)
  const totalPending = pendingSchedules.length
  const recentCompleted = completedChecklists.slice(0, 5)

  const defaultTab =
    overdue.length > 0 || today.length > 0 ? "pendientes" : "completados"
  const hasAnyContent = totalPending > 0 || completedChecklists.length > 0

  return (
    <DashboardShell>
      <div className="checklist-module space-y-4">
        <AssetDetailHeader
          asset={asset}
          assetId={assetId}
          onBack={() => router.back()}
        />

        {isOnline === false && <AssetDetailOfflineBanner />}

        {hasAnyContent ? (
          <>
            <AssetDetailKpiCard
              totalPending={totalPending}
              overdue={overdue.length}
              today={today.length}
              recentCompleted={recentCompleted.length}
              asset={asset}
            />

            <Tabs defaultValue={defaultTab} className="space-y-4">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger
                  value="pendientes"
                  className="flex items-center gap-2 cursor-pointer transition-colors duration-200"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Pendientes
                </TabsTrigger>
                <TabsTrigger
                  value="completados"
                  className="flex items-center gap-2 cursor-pointer transition-colors duration-200"
                >
                  <FileText className="h-4 w-4" />
                  Completados
                </TabsTrigger>
                <TabsTrigger
                  value="informacion"
                  className="flex items-center gap-2 cursor-pointer transition-colors duration-200"
                >
                  <Truck className="h-4 w-4" />
                  Información
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pendientes" className="mt-6">
                <PendientesTab
                  overdue={overdue}
                  today={today}
                  upcoming={upcoming}
                  future={future}
                  onReschedule={setRescheduleId}
                  formatDate={formatDate}
                  formatRelativeDate={getRelativeDateDescription}
                  assetId={assetId}
                />
              </TabsContent>

              <TabsContent value="completados" className="mt-6">
                <CompletadosTab
                  completed={completedChecklists}
                  formatRelativeDate={getRelativeDateDescription}
                  assetId={assetId}
                />
              </TabsContent>

              <TabsContent value="informacion" className="mt-6">
                <InformacionTab
                  asset={asset}
                  totalPending={totalPending}
                  overdue={overdue.length}
                  today={today.length}
                  recentCompleted={recentCompleted.length}
                />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <PendientesTab
            overdue={[]}
            today={[]}
            upcoming={[]}
            future={[]}
            onReschedule={setRescheduleId}
            formatDate={formatDate}
            formatRelativeDate={getRelativeDateDescription}
            assetId={assetId}
          />
        )}

        <div className="mt-6">
          <OfflineStatus showDetails onSyncComplete={handleSyncComplete} />
        </div>

        {rescheduleId && (
          <RescheduleChecklistModal
            scheduleId={rescheduleId}
            open={!!rescheduleId}
            onOpenChange={(o) => setRescheduleId(o ? rescheduleId : null)}
            onRescheduled={handleRescheduled}
          />
        )}
      </div>
    </DashboardShell>
  )
}
