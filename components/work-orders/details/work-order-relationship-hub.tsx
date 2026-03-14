"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EntityRelations } from "@/components/navigation/entity-relations"

export interface WorkOrderRelationshipHubProps {
  assetId: string | null
  workOrderId: string | null
  incidentId: string | null
  checklistId: string | null
  purchaseOrderId: string | null
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
  purchaseOrderId,
  isIncidentOrigin,
  isChecklistOrigin,
  checklistOriginName,
}: WorkOrderRelationshipHubProps) {
  const labels = {
    incident: isIncidentOrigin ? "Origen: incidente" : undefined,
    checklist:
      isChecklistOrigin && checklistOriginName
        ? `Origen: ${checklistOriginName}`
        : isChecklistOrigin
          ? "Origen: checklist"
          : undefined,
    purchaseOrder: purchaseOrderId ? "OC relacionada" : undefined,
  }

  const hasRelations =
    assetId || workOrderId || incidentId || checklistId || purchaseOrderId

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
          purchaseOrderId={purchaseOrderId}
          labels={labels}
        />
      </CardContent>
    </Card>
  )
}
