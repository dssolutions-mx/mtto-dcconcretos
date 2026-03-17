"use client"

import { ClipboardList, FileCheck, ShieldCheck } from "lucide-react"
import { useDashboardPendingActions } from "@/hooks/useDashboardPendingActions"
import { DashboardActionStrip } from "./dashboard-action-strip"
import { Loader2 } from "lucide-react"

interface DashboardPOActionStripProps {
  role: string
}

/**
 * Renders the PO-related action strip for Gerente, Administración, or Gerencia General.
 * Only mounts for these roles so the pending-actions API is only called when needed.
 */
export function DashboardPOActionStrip({ role }: DashboardPOActionStripProps) {
  const { data, loading } = useDashboardPendingActions()

  if (loading) {
    return (
      <div className="flex items-center gap-4 rounded-lg border bg-card px-6 py-5 border-border/60">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Cargando pendientes...</span>
      </div>
    )
  }

  const counts = data ?? { technicalValidation: 0, viabilityReview: 0, gmApproval: 0 }

  if (role === "GERENTE_MANTENIMIENTO") {
    return (
      <DashboardActionStrip
        icon={ClipboardList}
        count={counts.technicalValidation}
        label="órdenes esperan tu validación técnica"
        href="/compras?tab=pending"
        ctaLabel="Validar ahora"
      />
    )
  }

  if (role === "AREA_ADMINISTRATIVA") {
    return (
      <DashboardActionStrip
        icon={FileCheck}
        count={counts.viabilityReview}
        label="órdenes esperan revisión de viabilidad"
        href="/compras?tab=pending"
        ctaLabel="Revisar"
      />
    )
  }

  if (role === "GERENCIA_GENERAL") {
    return (
      <DashboardActionStrip
        icon={ShieldCheck}
        count={counts.gmApproval}
        label="órdenes ≥$7k esperan aprobación"
        href="/compras?tab=pending"
        ctaLabel="Aprobar"
      />
    )
  }

  return null
}
