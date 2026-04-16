/**
 * Client-side helpers for PUT /api/purchase-orders/advance-workflow responses.
 * Technical validation often returns success while the PO stays pending_approval.
 */

export function purchaseOrderStaysPendingAfterApproveResponse(
  data: Record<string, unknown>
): boolean {
  return data.awaiting_viability === true || data.escalated_to_gm === true
}

/** Toast copy after a successful advance-workflow approve (full or intermediate). */
export function getApproveSuccessToastContent(
  data: Record<string, unknown>,
  orderDisplayId: string
): { title: string; description: string } {
  const msg = typeof data.message === "string" ? data.message.trim() : ""

  if (data.escalated_to_gm === true) {
    return {
      title: "Autorización técnica registrada",
      description:
        msg ||
        `La orden ${orderDisplayId} quedó pendiente: Gerencia General debe dar la aprobación final.`,
    }
  }

  if (data.awaiting_viability === true) {
    return {
      title: "Validación técnica registrada",
      description:
        msg ||
        `La orden ${orderDisplayId} quedó pendiente: Área Administrativa debe registrar viabilidad antes de la aprobación final.`,
    }
  }

  return {
    title: "Orden aprobada",
    description:
      msg || `La orden ${orderDisplayId} fue aprobada y puede continuar en el flujo de compra.`,
  }
}

/** Copy for compras list quick actions + confirm dialog (aligned with detail WorkflowStatusDisplay). */
export function getListApprovalCopy(
  workflowStage: string | undefined,
  actorRole: string | undefined
): {
  approveTooltip: string
  approveAria: string
  dialogTitleApprove: string
  dialogConfirmApprove: string
  primaryButtonApprove: string
} {
  const isGG = actorRole === "GERENCIA_GENERAL"
  const stage = workflowStage ?? ""

  if (stage === "Validación técnica") {
    if (isGG) {
      return {
        approveTooltip: "Aprobar (bypass)",
        approveAria: "Aprobar orden con bypass de Gerencia General",
        dialogTitleApprove: "Confirmar aprobación",
        dialogConfirmApprove:
          "¿Confirmas la aprobación directa de esta orden? Como Gerencia General puedes completar el flujo en un solo paso cuando aplica.",
        primaryButtonApprove: "Aprobar",
      }
    }
    return {
      approveTooltip: "Validación técnica",
      approveAria: "Registrar validación técnica (la orden puede seguir en otros pasos)",
      dialogTitleApprove: "Confirmar validación técnica",
      dialogConfirmApprove:
        "¿Confirmas registrar la validación técnica? La orden puede permanecer pendiente para viabilidad administrativa o aprobación final, según el caso.",
      primaryButtonApprove: "Registrar validación",
    }
  }

  if (stage === "Aprobación final") {
    return {
      approveTooltip: "Aprobación final",
      approveAria: "Dar aprobación final a la orden",
      dialogTitleApprove: "Confirmar aprobación final",
      dialogConfirmApprove: "¿Confirmas la aprobación final de esta orden de compra?",
      primaryButtonApprove: "Aprobar",
    }
  }

  return {
    approveTooltip: "Aprobar",
    approveAria: "Aprobar orden",
    dialogTitleApprove: "Confirmar aprobación",
    dialogConfirmApprove: "¿Confirmas que quieres aprobar esta orden de compra?",
    primaryButtonApprove: "Aprobar",
  }
}
