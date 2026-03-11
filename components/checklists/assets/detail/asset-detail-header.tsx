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
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      id="asset-detail-header"
    >
      <div className="grid gap-1 min-w-0 flex-1 shrink-0">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate font-sans">
          Checklists - {asset.name}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground line-clamp-2 md:line-clamp-none">
          {subtitle}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="cursor-pointer transition-colors duration-200 shrink-0"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link
            href={`/activos/${assetId}/reporte-checklists`}
            className="cursor-pointer transition-colors duration-200 inline-flex items-center"
          >
            <FileText className="mr-2 h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Reporte de Evidencias</span>
            <span className="sm:hidden">Reporte</span>
          </Link>
        </Button>
        <Button
          size="sm"
          asChild
          className="bg-checklist-cta hover:bg-checklist-cta/90 text-white shrink-0"
        >
          <Link
            href={`/checklists/programar?asset=${assetId}`}
            className="cursor-pointer transition-colors duration-200"
          >
            <Plus className="mr-2 h-4 w-4" />
            Programar
          </Link>
        </Button>
      </div>
    </div>
  )
}
