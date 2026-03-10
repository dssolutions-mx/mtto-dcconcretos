"use client"

import { use } from "react"
import { AssetChecklistDetailPage } from "@/components/checklists/assets/detail/asset-checklist-detail-page"
import { useOfflineSync } from "@/hooks/useOfflineSync"

export default function AssetChecklistDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { isOnline } = useOfflineSync()

  return (
    <AssetChecklistDetailPage
      params={params}
      isOnline={isOnline}
    />
  )
}
