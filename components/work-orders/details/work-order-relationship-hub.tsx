"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EntityRelations } from "@/components/navigation/entity-relations"

export interface WorkOrderRelationshipHubProps {
  assetId: string | null
  workOrderId: string | null
  incidentId: string | null
  checklistId: string | null
  /** Legacy single OC pointer on work_orders */
  purchaseOrderId?: string | null
  /** All OC ids linked to this OT (`purchase_orders.work_order_id`) */
  purchaseOrderIds?: string[] | null
  /** When incident is the origin, use "Origen: incidente" */
  isIncidentOrigin?: boolean
  /** When checklist is the origin, use "Origen: checklist" or checklist name */
  isChecklistOrigin?: boolean
  checklistOriginName?: string | null
}

export function WorkOrderRelationshipHub({
  assetId,
  workOrderId,
  incidentId,
  checklistId,
  purchaseOrderId = null,
  purchaseOrderIds = null,
  isIncidentOrigin,
  isChecklistOrigin,
  checklistOriginName,
}: WorkOrderRelationshipHubProps) {
  const poCount = (purchaseOrderIds?.length ?? 0) + (purchaseOrderId && !purchaseOrderIds?.length ? 1 : 0)

  const labels = {
    incident: isIncidentOrigin ? "Origen: incidente" : undefined,
    checklist:
      isChecklistOrigin && checklistOriginName
        ? `Origen: ${checklistOriginName}`
        : isChecklistOrigin
          ? "Origen: checklist"
          : undefined,
    purchaseOrder:
      (purchaseOrderIds?.length ?? 0) > 1
        ? "Órdenes de compra"
        : poCount > 0
          ? "OC relacionada"
          : undefined,
  }

  const hasRelations =
    assetId ||
    workOrderId ||
    incidentId ||
    checklistId ||
    purchaseOrderId ||
    (purchaseOrderIds && purchaseOrderIds.length > 0)

  if (!hasRelations) return null

  return (
    <Card className="no-print">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-base">Relaciones</CardTitle>
        <CardDescription className="text-xs">Accesos a entidades relacionadas</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <EntityRelations
          assetId={assetId}
          workOrderId={workOrderId}
          incidentId={incidentId}
          checklistId={checklistId}
          purchaseOrderId={purchaseOrderIds?.length ? null : purchaseOrderId}
          purchaseOrderIds={purchaseOrderIds?.length ? purchaseOrderIds : null}
          labels={labels}
        />
      </CardContent>
    </Card>
  )
}
