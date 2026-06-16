"use client"

import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  PIPELINE_STAGE_LABELS,
  type RoutedIncident,
} from "@/lib/incidents/incident-routing"
import { getStatusInfo } from "@/components/incidents/incidents-status-utils"
import {
  CANONICAL_ROUTING_DEPARTMENTS,
  type CanonicalRoutingDepartmentSlug,
} from "@/lib/incidents/incident-routing-departments"

type RoutingIncidentRow = RoutedIncident & {
  canonical_department_slug?: CanonicalRoutingDepartmentSlug | null
}

function canonicalLabel(slug: CanonicalRoutingDepartmentSlug | null | undefined): string {
  if (!slug) return "—"
  return CANONICAL_ROUTING_DEPARTMENTS.find((d) => d.slug === slug)?.shortLabel ?? slug
}

export function IncidentRoutingTable({
  incidents,
  compact = false,
}: {
  incidents: RoutingIncidentRow[]
  compact?: boolean
}) {
  if (incidents.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No hay incidentes con los filtros actuales.
      </p>
    )
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[88px]">Activo</TableHead>
            <TableHead className="w-[100px]">Tipo</TableHead>
            {!compact && <TableHead className="w-[88px]">Depto</TableHead>}
            <TableHead className="w-[88px]">Etapa</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="w-[96px]">Estado</TableHead>
            <TableHead className="w-[72px] text-right">Días</TableHead>
            <TableHead className="w-[64px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((incident) => {
            const statusInfo = getStatusInfo(String(incident.status ?? ""))
            const stage = incident.pipeline_stage ?? "bandeja"
            const days = incident.created_at
              ? Math.ceil(
                  (Date.now() - new Date(incident.created_at).getTime()) / (1000 * 60 * 60 * 24),
                )
              : null

            return (
              <TableRow
                key={incident.id}
                className={
                  incident.sla_breached
                    ? "bg-red-50/60"
                    : days != null && days >= 7
                      ? "bg-amber-50/40"
                      : undefined
                }
              >
                <TableCell className="font-mono text-xs py-2">
                  {incident.asset_code ?? "—"}
                </TableCell>
                <TableCell className="text-xs py-2">{incident.type}</TableCell>
                {!compact && (
                  <TableCell className="text-xs py-2">
                    {canonicalLabel(incident.canonical_department_slug)}
                  </TableCell>
                )}
                <TableCell className="text-xs py-2">
                  {PIPELINE_STAGE_LABELS[stage] ?? stage}
                </TableCell>
                <TableCell className="py-2">
                  <p className="text-sm line-clamp-1">{incident.description}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {incident.assignee_name ?? "Sin responsable"}
                    {incident.date
                      ? ` · ${format(new Date(incident.date), "dd MMM yy", { locale: es })}`
                      : ""}
                  </p>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                      {statusInfo.label}
                    </Badge>
                    {incident.sla_breached && (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-label="SLA" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums py-2">
                  {days ?? "—"}
                </TableCell>
                <TableCell className="py-2 text-right">
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    <Link href={`/incidentes/${incident.id}`}>Ver</Link>
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
