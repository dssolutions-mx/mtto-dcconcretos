"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ClipboardCheck,
  Clock,
  AlertTriangle,
  Truck,
  User,
  Calendar,
  Loader2,
  RefreshCw,
  Fuel,
  ChevronRight,
  CheckCircle2,
} from "lucide-react"
import { useOperatorChecklists } from "@/hooks/useOperatorChecklists"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { OperatorReportProblemDialog } from "@/components/operator/operator-report-problem-dialog"
import type { OperatorIncidentsApiResponse, OperatorIncidentItem } from "@/types/operator-incidents"
import {
  trafficLightForOpenCount,
  workOrderStatusLabelForOperator,
  friendlyIncidentTypeLabel,
  operatorIncidentSecondaryLine,
} from "@/lib/operator-incident-ui"

type ScheduleAssetInfo = {
  assets?: { id?: string; name?: string | null; asset_id?: string | null } | null
  assigned_asset?: { id?: string; name?: string | null; asset_id?: string | null } | null
}

function OperatorScheduleAssetLines({ checklist }: { checklist: ScheduleAssetInfo }) {
  const part = checklist.assets
  const unit = checklist.assigned_asset
  const showPart = part?.asset_id
  const showUnit = unit?.asset_id && unit.id && part?.id && unit.id !== part.id

  if (showPart) {
    return (
      <div className="space-y-0.5">
        <p className="text-xs text-muted-foreground">
          Parte: {part?.name ?? "—"} ({part.asset_id})
        </p>
        {showUnit ? (
          <p className="text-xs text-muted-foreground">
            Unidad: {unit?.name ?? "—"} ({unit.asset_id})
          </p>
        ) : null}
      </div>
    )
  }

  if (unit?.asset_id) {
    return (
      <p className="text-sm text-gray-600">
        {unit.name} ({unit.asset_id})
      </p>
    )
  }

  return null
}

export default function OperatorDashboard() {
  const router = useRouter()
  const { profile, isInitialized, isAuthenticated, isLoading: authLoading } = useAuthZustand()
  const { data, loading, error, isOperator: hookIsOperator, refetch } = useOperatorChecklists()
  const isOperator = hookIsOperator && profile?.role === "OPERADOR"
  const [refreshing, setRefreshing] = useState(false)
  const [incidentsPayload, setIncidentsPayload] = useState<OperatorIncidentsApiResponse | null>(null)
  const [incidentsLoading, setIncidentsLoading] = useState(true)
  const [incidentsError, setIncidentsError] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    if (!isInitialized || (authLoading && !profile)) return
    if (!isAuthenticated || !profile) {
      router.push("/login")
      return
    }
    if (profile.role === "DOSIFICADOR") {
      router.replace("/dashboard/dosificador")
      return
    }
    if (profile.role !== "OPERADOR") {
      router.push("/dashboard")
    }
  }, [isInitialized, authLoading, isAuthenticated, profile, router])

  const loadIncidents = useCallback(async () => {
    try {
      setIncidentsLoading(true)
      setIncidentsError(null)
      const res = await fetch("/api/operator/incidents", { credentials: "include", cache: "no-store" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as OperatorIncidentsApiResponse
      setIncidentsPayload(json)
    } catch (e) {
      setIncidentsError(e instanceof Error ? e.message : "Error al cargar reportes")
      setIncidentsPayload(null)
    } finally {
      setIncidentsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOperator) loadIncidents()
  }, [isOperator, loadIncidents])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetch(), loadIncidents()])
    setRefreshing(false)
  }

  const reporterDisplayName = useMemo(() => {
    if (!profile) return ""
    return `${profile.nombre || ""} ${profile.apellido || ""}`.trim()
  }, [profile])

  const assignedForReport = useMemo(() => {
    if (!data?.assigned_assets?.length) return []
    return data.assigned_assets.map((a) => ({
      id: a.id,
      name: a.name,
      asset_id: a.asset_id,
    }))
  }, [data?.assigned_assets])

  const recentIncidents = useMemo(() => {
    if (!incidentsPayload?.assets?.length) return []
    const flat: OperatorIncidentItem[] = incidentsPayload.assets
      .flatMap((g) => g.incidents)
      .filter((i) => i.is_open)
    return [...flat].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)
  }, [incidentsPayload])

  const checklistActionCount = useMemo(() => {
    if (!data?.stats) return 0
    return data.stats.today_checklists + data.stats.overdue_checklists
  }, [data?.stats])

  if (!isInitialized || (authLoading && !profile)) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Cargando…" text="Preparando tu panel." />
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    )
  }

  if (isInitialized && profile?.role === "DOSIFICADOR") {
    return (
      <DashboardShell>
        <DashboardHeader heading="Redirigiendo…" text="Abriendo tu panel de dosificador." />
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    )
  }

  if (!isOperator) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Acceso denegado" text="Esta página es solo para operadores." />
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Si crees que es un error, contacta a tu supervisor.
          </AlertDescription>
        </Alert>
      </DashboardShell>
    )
  }

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Cargando…" text="Preparando tu panel." />
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    )
  }

  if (error) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Error" text="No se pudo cargar tu información." />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Reintentar
        </Button>
      </DashboardShell>
    )
  }

  if (!data) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Sin datos" text="No se encontró información para tu perfil." />
      </DashboardShell>
    )
  }

  const { operator, assigned_assets, today_checklists, overdue_checklists, stats } = data
  const totalOpen = incidentsPayload?.summary.total_open ?? 0

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={refreshing}>
      <DashboardShell className="space-y-6">
        <DashboardHeader
          heading={`Hola, ${operator.nombre ?? ""}`.trim()}
          text="Primero ejecuta tus checklists (atrasados y de hoy). Después puedes revisar reportes."
        >
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="shrink-0">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1.5 hidden sm:inline">Actualizar</span>
          </Button>
        </DashboardHeader>

        {incidentsError && (
          <Alert variant="destructive">
            <AlertDescription>{incidentsError}</AlertDescription>
          </Alert>
        )}

        {assigned_assets.length === 0 && (
          <Alert>
            <User className="h-4 w-4" />
            <AlertDescription>
              <strong>No tienes activos asignados.</strong> Contacta a tu supervisor.
            </AlertDescription>
          </Alert>
        )}

        {(overdue_checklists.length > 0 || today_checklists.length > 0) && assigned_assets.length > 0 && (
          <div className="rounded-xl border-2 border-primary/40 bg-primary/5 px-4 py-3 dark:border-primary/50 dark:bg-primary/10">
            <p className="text-base font-bold">Empieza aquí</p>
            <p className="text-sm text-muted-foreground">
              Primero los <strong>atrasados</strong>, luego los de <strong>hoy</strong>. Toca Ejecutar en cada fila.
            </p>
          </div>
        )}

        {overdue_checklists.length > 0 && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
                <AlertTriangle className="h-5 w-5" />
                Checklists atrasados — ejecútalos primero
              </CardTitle>
              <CardDescription className="text-red-700 dark:text-red-300">
                Son los más urgentes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {overdue_checklists.slice(0, 5).map((checklist) => (
                <div
                  key={checklist.id}
                  className="flex flex-col gap-3 rounded-lg border border-red-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/50 dark:bg-card"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">Atrasado</Badge>
                      <span className="font-medium">{checklist.checklists?.name}</span>
                    </div>
                    <OperatorScheduleAssetLines checklist={checklist} />
                    <p className="mt-1 text-xs text-red-600">
                      Programado: {format(new Date(checklist.scheduled_date), "PPP", { locale: es })}
                    </p>
                  </div>
                  <Button asChild size="lg" className="min-h-[48px] w-full shrink-0 sm:w-auto sm:min-w-[140px]">
                    <Link href={`/checklists/ejecutar/${checklist.id}`}>Ejecutar</Link>
                  </Button>
                </div>
              ))}
              {overdue_checklists.length > 5 && (
                <Button variant="outline" asChild className="min-h-[44px] w-full">
                  <Link href="/checklists?tab=overdue">Ver todos los atrasados ({overdue_checklists.length})</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {today_checklists.length > 0 && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <Calendar className="h-5 w-5" />
                Checklists para hoy — ejecútalos después de atrasados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {today_checklists.slice(0, 5).map((checklist) => (
                <div
                  key={checklist.id}
                  className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-blue-900/50 dark:bg-card"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Hoy
                      </Badge>
                      <span className="font-medium">{checklist.checklists?.name}</span>
                    </div>
                    <OperatorScheduleAssetLines checklist={checklist} />
                  </div>
                  <Button asChild size="lg" className="min-h-[48px] w-full shrink-0 sm:w-auto sm:min-w-[140px]">
                    <Link href={`/checklists/ejecutar/${checklist.id}`}>Ejecutar</Link>
                  </Button>
                </div>
              ))}
              {today_checklists.length > 5 && (
                <Button variant="outline" asChild className="min-h-[44px] w-full">
                  <Link href="/checklists?tab=today">Ver todos los de hoy ({today_checklists.length})</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {assigned_assets.length > 0 &&
          overdue_checklists.length === 0 &&
          today_checklists.length === 0 && (
            <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-900 dark:text-emerald-100">
                No tienes checklists <strong>atrasados</strong> ni <strong>para hoy</strong>. Puedes abrir la lista
                completa o revisar los próximos.
              </AlertDescription>
            </Alert>
          )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="default" size="lg" className="min-h-[52px] w-full gap-2" asChild>
            <Link href="/checklists">
              <ClipboardCheck className="h-5 w-5" />
              Mis checklists
              {checklistActionCount > 0 && (
                <Badge className="ml-1 bg-primary-foreground/20 text-primary-foreground">{checklistActionCount}</Badge>
              )}
            </Link>
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="min-h-[52px] w-full gap-2 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
            onClick={() => setReportOpen(true)}
          >
            <AlertTriangle className="h-5 w-5" />
            Reportar problema
          </Button>
        </div>

        <OperatorReportProblemDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          assignedAssets={assignedForReport}
          reporterDisplayName={reporterDisplayName}
          onSuccess={() => {
            loadIncidents()
            refetch()
          }}
        />

        <div
          className={cn(
            "rounded-xl border px-4 py-4",
            totalOpen > 0
              ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30"
              : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30"
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            {totalOpen > 0 ? (
              <AlertTriangle className="h-8 w-8 shrink-0 text-amber-600" aria-hidden />
            ) : (
              <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-tight">
                {totalOpen > 0
                  ? `${totalOpen} ${totalOpen === 1 ? "problema abierto" : "problemas abiertos"} en tu equipo`
                  : "Sin problemas abiertos en el sistema"}
              </p>
              <p className="text-sm text-muted-foreground">
                {totalOpen > 0
                  ? "Así va el seguimiento en mantenimiento (órdenes de trabajo)."
                  : "Si algo falla en la unidad, usa Reportar problema arriba."}
              </p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activos asignados</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_assets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hoy</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.today_checklists}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.overdue_checklists}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximos</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.upcoming_checklists}</div>
            </CardContent>
          </Card>
        </div>

        {/* Per-asset accountability */}
        {incidentsPayload && assigned_assets.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Tu equipo en el sistema
              </h2>
              <Link
                href="/dashboard/operator/incidentes?estado=abiertos"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Ver historial del equipo
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {incidentsPayload.assets.map((g) => {
                const open = g.open_incidents
                const light = trafficLightForOpenCount(open)
                const pendingWo = g.incidents
                  .filter((i) => i.is_open)
                  .filter(
                    (i) => i.work_order && (i.work_order.status || "").toLowerCase() !== "completada"
                  ).length
                return (
                  <Link
                    key={g.asset_uuid}
                    href={`/dashboard/operator/incidentes?asset=${encodeURIComponent(g.asset_uuid)}&estado=abiertos`}
                    className="block rounded-xl border border-border/80 bg-card p-4 transition-colors hover:bg-muted/40 active:bg-muted/60"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-1 h-4 w-4 shrink-0 rounded-full",
                          light === "green" && "bg-emerald-500",
                          light === "yellow" && "bg-amber-400",
                          light === "red" && "bg-red-500"
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xl font-bold tabular-nums">{g.asset_id ?? "—"}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{g.asset_name}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="tabular-nums">
                            {open} {open === 1 ? "problema" : "problemas"}
                          </Badge>
                          {pendingWo > 0 && (
                            <Badge variant="outline" className="border-amber-300 text-amber-800">
                              {pendingWo} orden{pendingWo === 1 ? "" : "es"} en proceso
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {incidentsLoading && !incidentsPayload && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando reportes…
          </div>
        )}

        {/* Recent activity */}
        {recentIncidents.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Últimos reportes</CardTitle>
              <CardDescription>Toca para ver detalle y estado de la orden</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border/60 px-0 pb-0">
              {recentIncidents.map((inc) => {
                const secondary = operatorIncidentSecondaryLine(inc.work_order)
                return (
                  <Link
                    key={inc.id}
                    href={`/dashboard/operator/incidentes/${inc.id}?estado=abiertos`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 min-h-[56px]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {inc.asset_code} · {friendlyIncidentTypeLabel(inc.type)}
                      </p>
                      <p className="truncate text-sm font-medium">{inc.description}</p>
                      {secondary && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{secondary}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {inc.work_order?.order_id ?? "—"} · {workOrderStatusLabelForOperator(inc.work_order)}
                    </Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        )}

        {assigned_assets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Mis activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {assigned_assets.map((asset) => (
                  <div key={asset.id} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-medium">{asset.name}</h3>
                      <Badge variant={asset.status === "operational" ? "default" : "secondary"}>
                        {asset.status === "operational" ? "Operativo" : asset.status}
                      </Badge>
                    </div>
                    <p className="mb-2 text-sm text-muted-foreground">Código: {asset.asset_id}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {asset.assignment_type === "primary" ? "Principal" : "Secundario"}
                      </Badge>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/checklists/assets/${asset.id}`}>Checklists</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Más</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button asChild variant="outline" className="min-h-[48px] justify-start">
              <Link href="/dashboard/operator/incidentes?estado=abiertos">
                <AlertTriangle className="mr-2 h-5 w-5" />
                Incidentes del equipo
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-[48px] justify-start">
              <Link href="/checklists/assets">
                <Truck className="mr-2 h-5 w-5" />
                Por activo
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-[48px] justify-start">
              <Link href="/checklists/problemas-pendientes">
                <AlertTriangle className="mr-2 h-5 w-5" />
                Problemas checklist
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-[48px] justify-start">
              <Link href="/diesel">
                <Fuel className="mr-2 h-5 w-5" />
                Diesel
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardShell>
    </PullToRefresh>
  )
}
