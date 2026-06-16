"use client"

import { use } from "react"
import { useAsset } from "@/hooks/useSupabase"
import { AssetTiresPageClient } from "@/components/tires/asset-tires-page"

export default function AssetTiresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: assetId } = use(params)
  const { asset } = useAsset(assetId)

  return (
    <AssetTiresPageClient
      assetId={assetId}
      assetName={asset?.name ?? asset?.asset_id}
    />
  )
}
