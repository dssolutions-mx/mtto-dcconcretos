import {
  CheckCircle2,
  AlertCircle,
  Clock,
  PlayCircle,
  AlertTriangle,
  XCircle,
  Wrench,
  ArrowUp,
  Timer,
  Star,
  Flame,
} from "lucide-react"

export const STATUS_MAPPING: Record<string, string> = {
  abierto: "open",
  pendiente: "pending",
  "en progreso": "in_progress",
  "en proceso": "in_progress",
  resuelto: "resolved",
  cerrado: "resolved",
  open: "open",
  pending: "pending",
  "in progress": "in_progress",
  resolved: "resolved",
  closed: "resolved",
}

export function normalizeStatus(status: string): string {
  if (!status) return ""
  return STATUS_MAPPING[status.toLowerCase()] || status.toLowerCase()
}

export function getStatusInfo(status: string) {
  const normalized = normalizeStatus(status)
  switch (normalized) {
    case "resolved":
      return {
        label: "Resuelto",
        variant: "outline" as const,
        color: "text-white bg-green-600 border-green-600 hover:bg-green-700",
        icon: CheckCircle2,
        bgColor: "bg-green-50",
      }
    case "open":
      return {
        label: "Abierto",
        variant: "destructive" as const,
        color: "text-white bg-red-600 border-red-600 hover:bg-red-700",
        icon: AlertCircle,
        bgColor: "bg-red-50",
      }
    case "pending":
      return {
        label: "Pendiente",
        variant: "outline" as const,
        color: "text-white bg-orange-600 border-orange-600 hover:bg-orange-700",
        icon: Clock,
        bgColor: "bg-orange-50",
      }
    case "in_progress":
      return {
        label: "En Progreso",
        variant: "default" as const,
        color: "text-white bg-blue-600 border-blue-600 hover:bg-blue-700",
        icon: PlayCircle,
        bgColor: "bg-blue-50",
      }
    default:
      return {
        label: status || "Desconocido",
        variant: "secondary" as const,
        color: "text-white bg-gray-600 border-gray-600 hover:bg-gray-700",
        icon: AlertTriangle,
        bgColor: "bg-gray-50",
      }
  }
}

export function getTypeInfo(type: string) {
  switch (type?.toLowerCase()) {
    case "falla":
    case "falla eléctrica":
    case "falla mecánica":
    case "falla hidráulica":
      return { variant: "destructive" as const, icon: XCircle, color: "text-white bg-red-600 border-red-600" }
    case "mantenimiento":
      return { variant: "default" as const, icon: Wrench, color: "text-white bg-blue-600 border-blue-600" }
    case "accidente":
      return { variant: "secondary" as const, icon: AlertTriangle, color: "text-white bg-orange-600 border-orange-600" }
    case "alerta":
      return { variant: "default" as const, icon: AlertCircle, color: "text-black bg-yellow-400 border-yellow-400" }
    default:
      return { variant: "outline" as const, icon: AlertTriangle, color: "text-white bg-gray-600 border-gray-600" }
  }
}

export function getPriorityInfo(status: string, daysSinceCreated: number) {
  const normalized = normalizeStatus(status)
  if (normalized === "resolved") {
    return { level: "resolved", color: "text-white bg-green-600 border-green-600", label: "Completado", icon: CheckCircle2 }
  }
  if (daysSinceCreated >= 7) {
    return { level: "critical", color: "text-white bg-red-600 border-red-600", label: "Crítico", icon: Flame }
  }
  if (daysSinceCreated >= 3) {
    return { level: "high", color: "text-white bg-orange-600 border-orange-600", label: "Alto", icon: ArrowUp }
  }
  if (daysSinceCreated >= 1) {
    return { level: "medium", color: "text-black bg-yellow-400 border-yellow-400", label: "Medio", icon: Timer }
  }
  return { level: "low", color: "text-white bg-blue-600 border-blue-600", label: "Nuevo", icon: Star }
}

export function getDaysSinceCreated(createdAt: string): number {
  const created = new Date(createdAt)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - created.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}
