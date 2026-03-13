"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ClipboardCheck, FileText, PackageSearch, ShoppingCart, Wrench } from "lucide-react"

type EntityRelationsProps = {
  /** Asset UUID for asset-centric links (e.g. incident → /activos/{assetId}/incidentes). When provided, incident link uses asset-scoped URL. */
  assetId?: string | null
  serviceOrderId?: string | null
  workOrderId?: string | null
  incidentId?: string | null
  checklistId?: string | null
  purchaseOrderId?: string | null
  /** Optional intent-aware labels (e.g. "Origen: incidente", "OC relacionada") */
  labels?: {
    asset?: string
    incident?: string
    checklist?: string
    serviceOrder?: string
    purchaseOrder?: string
  }
  className?: string
}

export function EntityRelations({
  assetId,
  serviceOrderId,
  workOrderId,
  incidentId,
  checklistId,
  purchaseOrderId,
  labels,
  className,
}: EntityRelationsProps) {
  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="navigation"
      aria-label="Enlaces relacionados"
    >
      {assetId && (
        <RelationChip
          href={`/activos/${assetId}`}
          icon={<PackageSearch className="h-4 w-4" aria-hidden="true" />}
          label={labels?.asset ?? "Activo"}
          ariaLabel="Ver activo"
        />
      )}

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
          label={labels?.serviceOrder ?? "Servicio realizado"}
          ariaLabel={labels?.serviceOrder ?? "Ver orden de servicio"}
        />
      )}

      {incidentId && (
        <RelationChip
          href={assetId ? `/activos/${assetId}/incidentes` : "/incidentes"}
          icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          label={labels?.incident ?? "Incidente"}
          ariaLabel={labels?.incident ?? "Ver incidente relacionado"}
        />
      )}

      {checklistId && (
        <RelationChip
          href={`/checklists/ejecutar/${checklistId}`}
          icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
          label={labels?.checklist ?? "Checklist"}
          ariaLabel={labels?.checklist ?? "Ver checklist"}
        />
      )}

      {purchaseOrderId && (
        <RelationChip
          href={`/compras/${purchaseOrderId}`}
          icon={<ShoppingCart className="h-4 w-4" aria-hidden="true" />}
          label={labels?.purchaseOrder ?? "OC relacionada"}
          ariaLabel={labels?.purchaseOrder ?? "Ver orden de compra"}
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


