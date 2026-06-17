const PO_STATUS_LABELS: Record<string, string> = {
  approved: "Aprobada",
  purchased: "Comprada",
  ordered: "Pedida",
  receipt_uploaded: "Comprobante subido",
  received: "Recibida",
  validated: "Validada",
  fulfilled: "Cumplida",
}

export function formatPoStatus(status: string): string {
  return PO_STATUS_LABELS[status] ?? status
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString("es-MX")
  } catch {
    return value
  }
}
