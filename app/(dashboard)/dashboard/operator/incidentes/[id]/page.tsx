"use client"

import { use, useEffect, useState, useMemo, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, ArrowLeft, AlertTriangle, Wrench, User } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { cn } from "@/lib/utils"
import { dashboardHomeForRole } from "@/lib/dashboard-home"
import { workOrderStatusLabelForOperator, friendlyIncidentTypeLabel } from "@/lib/operator-incident-ui"

type DetailResponse = {
  id: string
  date: string
  type: string
  description: string
  status: string | null
  impact: string | null
  resolution: string | null
  documents: unknown
  created_at: string | null
  is_open: boolean
  asset: { id: string; name: string | null; asset_id: string | null; location: string | null } | null
  work_order: {
    id: string
    order_id: string
    status: string | null
    priority: string | null
    mechanic_name: string | null
    created_at: string | null
    completed_at: string | null
    description: string | null
    type: string | null
  } | null
}

function parseDocumentUrls(documents: unknown): string[] {
  if (!documents) return []
  if (Array.isArray(documents)) {
    return documents
      .map((d) => (typeof d === "string" ? d : (d as { url?: string })?.url))
      .filter((u): u is string => typeof u === "string" && u.length > 0)
  }
  return []
}

function useListBackHref() {
  const searchParams = useSearchParams()
  return useMemo(() => {
    const asset = searchParams.get("asset")
    const estado = searchParams.get("estado")
    const q = new URLSearchParams()
    if (asset) q.set("asset", asset)
    if (estado === "cerrados") q.set("estado", "cerrados")
    const s = q.toString()
    return s ? `/dashboard/operator/incidentes?${s}` : "/dashboard/operator/incidentes"
  }, [searchParams])
}

function DetailHeaderNav() {
  const listHref = useListBackHref()
  const { profile } = useAuthZustand()
  const panelHref = dashboardHomeForRole(profile?.role)
  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <Button variant="outline" size="sm" asChild className="min-h-[44px]">
        <Link href={listHref}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al listado
        </Link>
      </Button>
      <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
        <Link href={panelHref}>Panel</Link>
      </Button>
    </div>
  )
}

function OperatorIncidentDetailInner({ id }: { id: string }) {
  const router = useRouter()
  const { profile, isInitialized, isAuthenticated, isLoading: authLoading } = useAuthZustand()
  const [row, setRow] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!id || !profile || !["OPERADOR", "DOSIFICADOR"].includes(profile.role)) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/operator/incidents/${id}`, {
          credentials: "include",
          cache: "no-store",
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || `HTTP ${res.status}`)
        }
        const json = (await res.json()) as DetailResponse
        if (!cancelled) setRow(json)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error")
          setRow(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, profile])

  if (!profile || !["OPERADOR", "DOSIFICADOR"].includes(profile.role)) {
    return null
  }

  const urls = parseDocumentUrls(row?.documents)

  return (
    <DashboardShell className="space-y-4">
      <DashboardHeader heading="" text="">
        <DetailHeaderNav />
      </DashboardHeader>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && row && (
        <>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-muted p-3">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Problema en el equipo</p>
              <h1 className="text-xl font-bold leading-tight">{friendlyIncidentTypeLabel(row.type)}</h1>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(row.date), { addSuffix: true, locale: es })}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tu equipo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-bold tabular-nums">{row.asset?.asset_id ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{row.asset?.name}</p>
              {row.asset?.location && (
                <p className="text-xs text-muted-foreground">Ubicación: {row.asset.location}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Qué pasó</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-base leading-relaxed">{row.description}</p>
              {row.impact && (
                <p className="mt-3 text-sm text-muted-foreground">
                  <span className="font-semibold">Impacto: </span>
                  {row.impact}
                </p>
              )}
              {row.resolution && (
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Resolución: </span>
                  {row.resolution}
                </p>
              )}
            </CardContent>
          </Card>

          {urls.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Fotos</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {urls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </CardContent>
            </Card>
          )}

          <Card
            className={cn(
              "border-2",
              row.work_order &&
                (row.work_order.status || "").toLowerCase() === "completada"
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                : "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-5 w-5" />
                Orden de trabajo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!row.work_order && (
                <p className="text-sm text-muted-foreground">Aún no hay orden ligada a este incidente.</p>
              )}
              {row.work_order && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold tabular-nums">{row.work_order.order_id}</span>
                    <Badge
                      className={cn(
                        (row.work_order.status || "").toLowerCase() === "completada"
                          ? "bg-emerald-600"
                          : "bg-amber-600"
                      )}
                    >
                      {workOrderStatusLabelForOperator(row.work_order)}
                    </Badge>
                    {row.work_order.priority && (
                      <Badge variant="outline">Prioridad: {row.work_order.priority}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Mecánico:{" "}
                      <span className="font-medium">
                        {row.work_order.mechanic_name || "Sin asignar"}
                      </span>
                    </span>
                  </div>
                  {row.work_order.created_at && (
                    <p className="text-xs text-muted-foreground">
                      Creada: {new Date(row.work_order.created_at).toLocaleString("es-MX")}
                    </p>
                  )}
                  {row.work_order.completed_at && (
                    <p className="text-xs text-muted-foreground">
                      Terminada: {new Date(row.work_order.completed_at).toLocaleString("es-MX")}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </DashboardShell>
  )
}

export default function OperatorIncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolved = use(params)
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
      <OperatorIncidentDetailInner id={resolved.id} />
    </Suspense>
  )
}
