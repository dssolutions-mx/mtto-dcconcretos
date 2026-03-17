"use client"

import { ClipboardList, Users } from "lucide-react"
import { DashboardActionStrip } from "./dashboard-action-strip"
import Link from "next/link"

/**
 * Action strip for Jefe de Planta.
 * Links to compliance/checklist monitoring. Counts can be back-filled via API later.
 */
export function DashboardJefePlantaActionStrip() {
  return (
    <div className="flex flex-col gap-4">
      <DashboardActionStrip
        icon={ClipboardList}
        count={0}
        label="operadores sin checklist hoy"
        href="/compliance"
        ctaLabel="Ver cumplimiento"
      />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/organizacion/asignacion-activos"
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Users className="h-4 w-4" />
          Asignación operador-activo
        </Link>
      </div>
    </div>
  )
}
