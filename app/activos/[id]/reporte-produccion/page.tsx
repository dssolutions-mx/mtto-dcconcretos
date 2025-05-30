"use client"

import { use } from "react"
import { AssetProductionReport } from "@/components/assets/asset-production-report"

interface AssetProductionReportPageProps {
  params: Promise<{ id: string }>
}

export default function AssetProductionReportPage({ params }: AssetProductionReportPageProps) {
  const { id } = use(params)

  const handleClose = () => {
    window.history.back()
  }

  return <AssetProductionReport assetId={id} onClose={handleClose} />
} 