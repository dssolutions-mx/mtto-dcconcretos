"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText, Plus } from "lucide-react"
import Link from "next/link"

interface Asset {
  id: string
  name: string
  asset_id: string
  location: string | null
  department: string | null
  plants?: { name: string } | null
  departments?: { name: string } | null
}

interface AssetDetailHeaderProps {
  asset: Asset
  assetId: string
  onBack: () => void
}

export function AssetDetailHeader({ asset, assetId, onBack }: AssetDetailHeaderProps) {
  const plantName = asset.plants?.name || asset.location || "Sin planta"
  const departmentName = asset.departments?.name || asset.department || "Sin departamento"
  const subtitle = `Gestión de checklists para ${asset.asset_id} • ${plantName} • ${departmentName}`

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap" id="asset-detail-header">
      <div className="grid gap-1 min-w-0 flex-1">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate font-sans">
          Checklists - {asset.name}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground line-clamp-2 md:line-clamp-none">
          {subtitle}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Button
          variant="outline"
          onClick={onBack}
          className="cursor-pointer transition-colors duration-200"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <Button variant="outline" asChild>
          <Link
            href={`/activos/${assetId}/reporte-checklists`}
            className="cursor-pointer transition-colors duration-200"
          >
            <FileText className="mr-2 h-4 w-4" />
            Reporte de Evidencias
          </Link>
        </Button>
        <Button asChild className="bg-checklist-cta hover:bg-checklist-cta/90 text-white">
          <Link
            href={`/checklists/programar?asset=${assetId}`}
            className="cursor-pointer transition-colors duration-200"
          >
            <Plus className="mr-2 h-4 w-4" />
            Programar Checklist
          </Link>
        </Button>
      </div>
    </div>
  )
}
