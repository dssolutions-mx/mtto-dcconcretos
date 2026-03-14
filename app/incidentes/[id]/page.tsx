"use client"

import { use, useState, useEffect } from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { IncidentReviewContent } from "@/components/incidents/incident-review-content"
import { BreadcrumbSetter } from "@/components/navigation/breadcrumb-setter"

export default function IncidentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const incidentId = resolvedParams.id
  const [incident, setIncident] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchIncident = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/incidents/${incidentId}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        setIncident(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar el incidente")
        setIncident(null)
      } finally {
        setLoading(false)
      }
    }
    fetchIncident()
  }, [incidentId])

  const assetId = incident?.asset_id as string | undefined
  const assetCode = incident?.asset_code as string | undefined

  return (
    <DashboardShell>
      <BreadcrumbSetter
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Incidentes", href: "/incidentes" },
          {
            label: loading ? "Cargando..." : assetCode ? `Incidente - ${assetCode}` : "Detalle",
            href: loading ? "#" : `/incidentes/${incidentId}`,
          },
        ]}
      />
      <DashboardHeader heading="" text="">
        <Button variant="outline" asChild className="cursor-pointer">
          <Link href={assetId ? `/activos/${assetId}/incidentes` : "/incidentes"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ) : incident ? (
        <IncidentReviewContent
          incident={incident as Parameters<typeof IncidentReviewContent>[0]["incident"]}
          onWorkOrderGenerated={() => setIncident(null)}
        />
      ) : null}
    </DashboardShell>
  )
}
