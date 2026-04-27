"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EntityRelations } from "@/components/navigation/entity-relations"

export interface WorkOrderRelationshipHubProps {
  assetId: string | null
  /** Shown on the Activo chip when `assetId` is set (e.g. asset code or name) */
  assetLinkLabel?: string | null
  workOrderId: string | null
  incidentId: string | null
  checklistId: string | null
  /** Legacy single OC pointer on work_orders */
  purchaseOrderId?: string | null
  /** All OC ids linked to this OT (`purchase_orders.work_order_id`) */
  purchaseOrderIds?: string[] | null
  /** Rich list for chip labels (order_id, adjustment badge) */
  purchaseOrdersSummary?: Array<{
    id: string
    order_id?: string | null
    is_adjustment?: boolean | null
  }> | null
  /** When incident is the origin, use "Origen: incidente" */
  isIncidentOrigin?: boolean
  /** When checklist is the origin, use "Origen: checklist" or checklist name */
  isChecklistOrigin?: boolean
  checklistOriginName?: string | null
}

export function WorkOrderRelationshipHub({
  assetId,
  assetLinkLabel = null,
  workOrderId,
  incidentId,
  checklistId,
  purchaseOrderId = null,
  purchaseOrderIds = null,
  purchaseOrdersSummary = null,
  isIncidentOrigin,
  isChecklistOrigin,
  checklistOriginName,
}: WorkOrderRelationshipHubProps) {
  const purchaseOrderLinks = useMemo(() => {
    if (purchaseOrdersSummary && purchaseOrdersSummary.length > 0) {
      return purchaseOrdersSummary.map((po) => ({
        id: po.id,
        label: po.is_adjustment
          ? `Ajuste ${po.order_id ? String(po.order_id) : po.id.slice(0, 8)}`
          : po.order_id
            ? String(po.order_id)
            : `OC ${po.id.slice(0, 8)}`,
      }))
    }
    const ids =
      purchaseOrderIds && purchaseOrderIds.length > 0
        ? purchaseOrderIds
        : purchaseOrderId
          ? [purchaseOrderId]
          : []
    if (ids.length === 0) return null
    return ids.map((id, idx) => ({
      id,
      label: ids.length > 1 ? `OC ${idx + 1}` : "OC relacionada",
    }))
  }, [purchaseOrdersSummary, purchaseOrderIds, purchaseOrderId])

  const poDisplayCount =
    purchaseOrdersSummary?.length ??
    purchaseOrderIds?.length ??
    (purchaseOrderId ? 1 : 0)

  const labels = {
    incident: isIncidentOrigin ? "Origen: incidente" : undefined,
    checklist:
      isChecklistOrigin && checklistOriginName
        ? `Origen: ${checklistOriginName}`
        : isChecklistOrigin
          ? "Origen: checklist"
          : undefined,
    asset: assetLinkLabel?.trim() ? assetLinkLabel.trim() : undefined,
    purchaseOrder:
      poDisplayCount > 1
        ? "Órdenes de compra"
        : poDisplayCount > 0
          ? "OC relacionada"
          : undefined,
  }

  const hasRelations =
    assetId ||
    workOrderId ||
    incidentId ||
    checklistId ||
    purchaseOrderId ||
    (purchaseOrderIds && purchaseOrderIds.length > 0) ||
    (purchaseOrdersSummary && purchaseOrdersSummary.length > 0) ||
    (purchaseOrderLinks && purchaseOrderLinks.length > 0)

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
          purchaseOrderId={
            !purchaseOrderLinks?.length && !purchaseOrderIds?.length ? purchaseOrderId : null
          }
          purchaseOrderIds={
            !purchaseOrderLinks?.length && purchaseOrderIds?.length ? purchaseOrderIds : null
          }
          purchaseOrderLinks={purchaseOrderLinks?.length ? purchaseOrderLinks : null}
          labels={labels}
        />
      </CardContent>
    </Card>
  )
}
