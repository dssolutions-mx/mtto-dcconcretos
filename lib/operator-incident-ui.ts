import type { OperatorIncidentWorkOrder } from "@/types/operator-incidents"

export function trafficLightForOpenCount(open: number): "green" | "yellow" | "red" {
  if (open <= 0) return "green"
  if (open <= 5) return "yellow"
  return "red"
}

export function workOrderStatusLabelForOperator(wo: OperatorIncidentWorkOrder): string {
  if (!wo) return "Sin orden"
  const st = (wo.status || "").toLowerCase()
  if (st === "completada" || st === "completed") return "Listo"
  if (st === "pendiente" || st === "pending") return "En espera"
  return wo.status || "En proceso"
}

export function friendlyIncidentTypeLabel(type: string): string {
  const t = type.toLowerCase()
  if (t.includes("mecán") || t.includes("mecan")) return "Mecánico"
  if (t.includes("hidrául")) return "Hidráulico"
  if (t.includes("eléct") || t.includes("elect")) return "Eléctrico"
  if (t.includes("accidente")) return "Accidente"
  if (t.includes("manten")) return "Mantenimiento"
  return type
}
