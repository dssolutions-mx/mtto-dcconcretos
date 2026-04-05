"use client"

import { AlertTriangle, CheckCircle, Clock, ShieldCheck, Users } from "lucide-react"
import type { KpiKey } from "./supplier-registry-constants"

const KPI_CARDS: {
  key: KpiKey
  label: string
  color: string
  textColor: string
  icon: typeof Users
}[] = [
  { key: "all", label: "Total", color: "border-gray-200 hover:border-gray-400", textColor: "text-gray-900", icon: Users },
  {
    key: "active_certified",
    label: "Certificados",
    color: "border-green-200 hover:border-green-400",
    textColor: "text-green-700",
    icon: ShieldCheck,
  },
  { key: "active", label: "Activos", color: "border-blue-200 hover:border-blue-400", textColor: "text-blue-700", icon: CheckCircle },
  { key: "pending", label: "Pendientes", color: "border-yellow-200 hover:border-yellow-400", textColor: "text-yellow-700", icon: Clock },
  {
    key: "issues",
    label: "Con Problemas",
    color: "border-red-200 hover:border-red-400",
    textColor: "text-red-700",
    icon: AlertTriangle,
  },
]

interface SuppliersKpiStripProps {
  loading: boolean
  statusFilter: string
  onStatusChange: (key: KpiKey) => void
  counts: {
    total: number
    certified: number
    active: number
    pending: number
    issues: number
  }
}

export function SuppliersKpiStrip({ loading, statusFilter, onStatusChange, counts }: SuppliersKpiStripProps) {
  const countMap: Record<KpiKey, number> = {
    all: counts.total,
    active_certified: counts.certified,
    active: counts.active,
    pending: counts.pending,
    issues: counts.issues,
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {KPI_CARDS.map((card) => {
        const Icon = card.icon
        const isActive = statusFilter === card.key
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onStatusChange(card.key)}
            className={`
                text-left p-3 rounded-lg border-2 transition-all cursor-pointer bg-card
                ${card.color}
                ${isActive ? "ring-2 ring-primary ring-offset-1" : ""}
              `}
          >
            <div className="flex items-center justify-between mb-1">
              <Icon className={`w-4 h-4 ${card.textColor}`} />
              <span className={`text-2xl font-bold ${card.textColor}`}>
                {loading ? "—" : countMap[card.key]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
          </button>
        )
      })}
    </div>
  )
}
