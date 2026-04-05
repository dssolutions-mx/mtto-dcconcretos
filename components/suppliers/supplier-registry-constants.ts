import { AlertTriangle, Ban, CheckCircle, Clock, ShieldCheck } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export const TYPE_COLORS: Record<string, string> = {
  individual: "bg-blue-500",
  company: "bg-green-500",
  distributor: "bg-purple-500",
  manufacturer: "bg-orange-500",
  service_provider: "bg-cyan-500",
}

export const TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  company: "Empresa",
  distributor: "Distribuidor",
  manufacturer: "Fabricante",
  service_provider: "Servicios",
  all: "Todos",
}

export const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: LucideIcon }
> = {
  pending: { label: "Pendiente", className: "bg-yellow-50 text-yellow-700 border-yellow-300", icon: Clock },
  active: { label: "Activo", className: "bg-blue-50 text-blue-700 border-blue-300", icon: CheckCircle },
  active_certified: {
    label: "Certificado",
    className: "bg-green-50 text-green-700 border-green-300",
    icon: ShieldCheck,
  },
  inactive: { label: "Inactivo", className: "bg-gray-50 text-gray-600 border-gray-300", icon: Clock },
  suspended: { label: "Suspendido", className: "bg-red-50 text-red-700 border-red-300", icon: AlertTriangle },
  blacklisted: { label: "Bloqueado", className: "bg-red-100 text-red-800 border-red-400", icon: Ban },
}

export type KpiKey = "all" | "active_certified" | "active" | "pending" | "issues"
