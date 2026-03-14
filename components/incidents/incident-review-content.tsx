"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EvidenceViewer } from "@/components/ui/evidence-viewer"
import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Wrench,
  ShoppingCart,
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { getIncidentEvidence } from "./incident-utils"

function formatDate(dateString: string | null): string {
  if (!dateString) return "No disponible"
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateString))
}

function getStatusBadge(status: string) {
  const normalized = status?.toLowerCase()
  const isResolved = normalized === "resuelto" || normalized === "cerrado"
  const isPending = normalized === "pendiente"
  const isInProgress = normalized === "en progreso"

  if (isResolved)
    return (
      <Badge variant="outline" className="text-green-600 border-green-600">
        <CheckCircle className="h-3 w-3 mr-1" />
        Resuelto
      </Badge>
    )
  if (isPending)
    return (
      <Badge variant="destructive">
        <AlertCircle className="h-3 w-3 mr-1" />
        Pendiente
      </Badge>
    )
  if (isInProgress)
    return (
      <Badge variant="default">
        <AlertTriangle className="h-3 w-3 mr-1" />
        En Progreso
      </Badge>
    )
  return <Badge variant="secondary">{status || "Desconocido"}</Badge>
}

function getTypeBadge(type: string) {
  switch (type?.toLowerCase()) {
    case "falla":
    case "falla eléctrica":
    case "falla mecánica":
    case "falla hidráulica":
      return <Badge variant="destructive">{type}</Badge>
    case "alerta":
      return <Badge variant="default">{type}</Badge>
    case "accidente":
      return <Badge variant="secondary">{type}</Badge>
    default:
      return <Badge variant="outline">{type || "—"}</Badge>
  }
}

interface IncidentReviewContentProps {
  incident: {
    id: string
    asset_id?: string
    asset_display_name?: string
    asset_code?: string
    date?: string
    type?: string
    status?: string
    reported_by?: string
    reported_by_name?: string
    description?: string
    impact?: string
    resolution?: string
    downtime?: number
    labor_hours?: number
    total_cost?: string | number
    work_order_text?: string
    work_order_id?: string
    work_order_order_id?: string
    purchase_order_id?: string
    parts?: string
    documents?: unknown
    created_at?: string
  }
  onWorkOrderGenerated?: () => void
}

export function IncidentReviewContent({
  incident,
  onWorkOrderGenerated,
}: IncidentReviewContentProps) {
  const { toast } = useToast()
  const reporterName =
    incident.reported_by_name || incident.reported_by || "Usuario desconocido"

  const handleGenerateWorkOrder = async () => {
    try {
      const response = await fetch("/api/work-orders/generate-from-incident", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_id: incident.id,
          priority:
            incident.type?.toLowerCase().includes("crítica") ||
            incident.type?.toLowerCase().includes("falla") ||
            incident.type?.toLowerCase().includes("accidente")
              ? "Alta"
              : "Media",
        }),
      })

      if (response.ok) {
        const { work_order_id } = await response.json()
        onWorkOrderGenerated?.()
        toast({
          title: "Orden de trabajo generada",
          description: "Se ha creado una orden de trabajo a partir del incidente.",
        })
        if (work_order_id) {
          window.location.href = `/ordenes/${work_order_id}`
        } else {
          window.location.reload()
        }
      } else {
        const err = await response.json().catch(() => ({}))
        toast({
          title: "Error",
          description: err.error || "No se pudo generar la orden de trabajo.",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Ocurrió un error al generar la orden de trabajo.",
        variant: "destructive",
      })
    }
  }

  const evidence = getIncidentEvidence(incident)
  let partsParsed: Array<{ name: string; partNumber?: string; quantity: number; cost?: string }> = []
  try {
    if (incident.parts) partsParsed = JSON.parse(incident.parts)
  } catch {
    /* ignore */
  }

  return (
    <div className="space-y-6">
      {/* Información General + Impacto */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm font-medium">Fecha:</span>
              <p className="text-sm text-muted-foreground">
                {formatDate(incident.date ?? null)}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium">Tipo:</span>
              <div className="mt-1">{getTypeBadge(incident.type ?? "")}</div>
            </div>
            <div>
              <span className="text-sm font-medium">Estado:</span>
              <div className="mt-1">{getStatusBadge(incident.status ?? "")}</div>
            </div>
            <div>
              <span className="text-sm font-medium">Reportado por:</span>
              <p className="text-sm text-muted-foreground">{reporterName}</p>
            </div>
            {incident.asset_id && (
              <div>
                <span className="text-sm font-medium">Activo:</span>
                <p className="text-sm text-muted-foreground">
                  <Link
                    href={`/activos/${incident.asset_id}`}
                    className="text-primary hover:underline"
                  >
                    {incident.asset_code || incident.asset_display_name || "Ver activo"}
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Impacto y Costos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm font-medium">Tiempo Inactivo:</span>
              <p className="text-sm text-muted-foreground">
                {incident.downtime ? `${incident.downtime} hrs` : "No especificado"}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium">Horas de Trabajo:</span>
              <p className="text-sm text-muted-foreground">
                {incident.labor_hours ? `${incident.labor_hours} hrs` : "No especificado"}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium">Costo Total:</span>
              <p className="text-sm text-muted-foreground">
                {incident.total_cost ? `$${incident.total_cost}` : "No especificado"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Descripción */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Descripción del Incidente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{incident.description || "—"}</p>
          {incident.impact && (
            <div className="mt-4">
              <span className="text-sm font-medium">Impacto:</span>
              <p className="text-sm text-muted-foreground mt-1">{incident.impact}</p>
            </div>
          )}
          {incident.resolution && (
            <div className="mt-4">
              <span className="text-sm font-medium">Resolución:</span>
              <p className="text-sm text-muted-foreground mt-1">{incident.resolution}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repuestos */}
      {partsParsed.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Repuestos Utilizados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {partsParsed.map((part, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-2 bg-muted rounded"
                >
                  <div>
                    <span className="text-sm font-medium">{part.name}</span>
                    {part.partNumber && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({part.partNumber})
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm">Cant: {part.quantity}</span>
                    {part.cost && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ${part.cost}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evidencia */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Evidencia del Incidente</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceViewer
            evidence={evidence}
            title=""
            showCategories
          />
        </CardContent>
      </Card>

      {/* Acciones: Ver OT / Generar OT */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Acciones</CardTitle>
        </CardHeader>
        <CardContent>
          {incident.work_order_id ? (
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full cursor-pointer">
                <Link href={`/ordenes/${incident.work_order_id}`}>
                  <Wrench className="h-4 w-4 mr-2" />
                  Ver Orden de Trabajo
                  {incident.work_order_order_id
                    ? ` #${incident.work_order_order_id}`
                    : ""}
                </Link>
              </Button>
              {incident.purchase_order_id && (
                <Button variant="outline" asChild className="w-full cursor-pointer">
                  <Link href={`/compras/${incident.purchase_order_id}`}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Ver Orden de Compra
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Button
              variant="default"
              className="w-full cursor-pointer"
              onClick={handleGenerateWorkOrder}
            >
              <Wrench className="h-4 w-4 mr-2" />
              Generar Orden de Trabajo
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
