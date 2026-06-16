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
import type { IncidentThreadHistoryItem } from "@/components/incidents/incident-thread-history"
import { BreadcrumbSetter } from "@/components/navigation/breadcrumb-setter"
import { pickThreadFromIncidentList } from "@/lib/incidents/incident-thread-utils"

async function resolveThreadIncidents(
  incident: Record<string, unknown>,
): Promise<IncidentThreadHistoryItem[]> {
  const fromApi = (incident.thread_incidents as IncidentThreadHistoryItem[] | undefined) ?? []
  if (fromApi.length > 1) return fromApi

  const assetId = incident.asset_id as string | undefined
  const description = incident.description as string | undefined
  if (!assetId || !description) return fromApi

  try {
    const allRes = await fetch("/api/incidents")
    if (!allRes.ok) return fromApi
    const all = (await allRes.json()) as Record<string, unknown>[]
    const picked = pickThreadFromIncidentList(
      all,
      assetId,
      description,
      typeof incident.canonical_issue_key === "string"
        ? incident.canonical_issue_key
        : null,
    )
    if (picked.length > fromApi.length) {
      return picked as IncidentThreadHistoryItem[]
    }
  } catch {
    // keep API result
  }

  return fromApi
}

export default function IncidentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const incidentId = resolvedParams.id
  const [incident, setIncident] = useState<Record<string, unknown> | null>(null)
  const [threadIncidents, setThreadIncidents] = useState<IncidentThreadHistoryItem[]>([])
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
        setThreadIncidents(await resolveThreadIncidents(data))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar el incidente")
        setIncident(null)
        setThreadIncidents([])
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
          threadIncidents={threadIncidents}
          onWorkOrderGenerated={() => {
            void (async () => {
              const res = await fetch(`/api/incidents/${incidentId}`)
              if (!res.ok) return
              const data = await res.json()
              setIncident(data)
              setThreadIncidents(await resolveThreadIncidents(data))
            })()
          }}
          onRoutingUpdated={() => {
            void (async () => {
              const res = await fetch(`/api/incidents/${incidentId}`)
              if (!res.ok) return
              const data = await res.json()
              setIncident(data)
            })()
          }}
        />
      ) : null}
    </DashboardShell>
  )
}
