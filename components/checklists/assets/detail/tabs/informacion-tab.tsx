"use client"

import { AssetDetailKpiCard } from "../asset-detail-kpi-card"

interface Asset {
  id: string
  name: string
  asset_id: string
  location: string | null
  department: string | null
  status: string
  current_hours: number | null
  plants?: { name: string } | null
  departments?: { name: string } | null
}

interface InformacionTabProps {
  asset: Asset
  totalPending: number
  overdue: number
  today: number
  recentCompleted: number
}

export function InformacionTab({
  asset,
  totalPending,
  overdue,
  today,
  recentCompleted,
}: InformacionTabProps) {
  return (
    <AssetDetailKpiCard
      totalPending={totalPending}
      overdue={overdue}
      today={today}
      recentCompleted={recentCompleted}
      asset={asset}
    />
  )
}
