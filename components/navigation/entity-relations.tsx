"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ClipboardCheck, FileText, PackageSearch, ShoppingCart, Wrench } from "lucide-react"

type EntityRelationsProps = {
  assetId: string
  serviceOrderId?: string | null
  workOrderId?: string | null
  incidentId?: string | null
  checklistId?: string | null
  purchaseOrderId?: string | null
  className?: string
}

export function EntityRelations({
  assetId,
  serviceOrderId,
  workOrderId,
  incidentId,
  checklistId,
  purchaseOrderId,
  className,
}: EntityRelationsProps) {
  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="navigation"
      aria-label="Enlaces relacionados"
    >
      <RelationChip
        href={`/activos/${assetId}`}
        icon={<PackageSearch className="h-4 w-4" aria-hidden="true" />}
        label="Activo"
        ariaLabel="Ver activo"
      />

      {workOrderId && (
        <RelationChip
          href={`/ordenes/${workOrderId}`}
          icon={<Wrench className="h-4 w-4" aria-hidden="true" />}
          label="OT"
          ariaLabel="Ver orden de trabajo"
        />
      )}

      {serviceOrderId && (
        <RelationChip
          href={`/servicios/${serviceOrderId}`}
          icon={<FileText className="h-4 w-4" aria-hidden="true" />}
          label="Servicio"
          ariaLabel="Ver orden de servicio"
        />
      )}

      {incidentId && (
        <RelationChip
          href={`/incidentes`}
          icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          label="Incidente"
          ariaLabel="Ver incidente relacionado"
        />
      )}

      {checklistId && (
        <RelationChip
          href={`/checklists/ejecutar/${checklistId}`}
          icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
          label="Checklist"
          ariaLabel="Ver checklist"
        />
      )}

      {purchaseOrderId && (
        <RelationChip
          href={`/compras/${purchaseOrderId}`}
          icon={<ShoppingCart className="h-4 w-4" aria-hidden="true" />}
          label="OC"
          ariaLabel="Ver orden de compra"
        />
      )}
    </div>
  )
}

function RelationChip({ href, icon, label, ariaLabel }: { href: string; icon: React.ReactNode; label: string; ariaLabel: string }) {
  return (
    <Button asChild variant="outline" size="lg" className="px-3 inline-flex items-center gap-2" aria-label={ariaLabel}>
      <Link href={href}>
        <span className="inline-flex items-center justify-center" aria-hidden="true">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </Link>
    </Button>
  )
}


