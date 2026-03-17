"use client"

import { FileText, ClipboardList } from "lucide-react"
import { DashboardActionStrip } from "./dashboard-action-strip"
import Link from "next/link"

/**
 * Action strip for Coordinador de Mantenimiento.
 * Links to work orders and compras. Counts can be back-filled via API later.
 */
export function DashboardCoordinatorActionStrip() {
  return (
    <div className="flex flex-col gap-4">
      <DashboardActionStrip
        icon={FileText}
        count={0}
        label="órdenes de trabajo y compra en tu zona"
        href="/ordenes"
        ctaLabel="Ver mis órdenes"
      />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/ordenes/crear"
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
        >
          <FileText className="h-4 w-4" />
          Crear OT+OC
        </Link>
        <Link
          href="/checklists"
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
        >
          <ClipboardList className="h-4 w-4" />
          Checklists de mi zona
        </Link>
      </div>
    </div>
  )
}
