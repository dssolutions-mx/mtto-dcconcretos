export const PO_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  pending_approval: "Pendiente de aprobación",
  approved: "Aprobado",
  rejected: "Rechazada",
  purchased: "Comprada",
  receipt_uploaded: "Comprobante subido",
  validated: "Validada",
  fulfilled: "Cumplida",
  quoted: "Cotizada",
  ordered: "Pedida",
  received: "Recibida",
}

export function getPOStatusLabel(status: string | null | undefined): string {
  if (!status) return "Sin estado"
  return PO_STATUS_LABELS[status] ?? status.replace(/_/g, " ")
}
