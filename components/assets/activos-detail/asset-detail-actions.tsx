"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  AlertTriangle,
  Edit,
  FileText,
  Wrench,
} from "lucide-react"

interface AssetDetailActionsProps {
  assetId: string
  assetName: string
  hasComposite: boolean
  setOpenCreateComposite: (open: boolean) => void
  onReportIncidentClick?: () => void
  ui: {
    shouldShowInNavigation: (module: string) => boolean
    canShowEditButton?: (module: string) => boolean
  }
}

export function AssetDetailActions({
  assetId,
  assetName,
  hasComposite,
  setOpenCreateComposite,
  onReportIncidentClick,
  ui,
}: AssetDetailActionsProps) {
  return (
    <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:flex-wrap sm:gap-2">
      {ui.shouldShowInNavigation("work_orders") && (
        <Button
          size="sm"
          asChild
          className="w-full sm:w-auto justify-center min-h-[44px] cursor-pointer transition-colors duration-200 bg-sky-700 hover:bg-sky-800 text-white"
        >
          <Link href={`/activos/${assetId}/mantenimiento/nuevo`}>
            <Wrench className="h-4 w-4 mr-2" />
            Crear OT
          </Link>
        </Button>
      )}
      {ui.shouldShowInNavigation("maintenance") && (
        <Button
          size="sm"
          variant="outline"
          className="w-full sm:w-auto justify-center min-h-[44px] cursor-pointer transition-colors duration-200"
          onClick={() => onReportIncidentClick?.()}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Reportar Incidente
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        asChild
        className="w-full sm:w-auto justify-center min-h-[44px] cursor-pointer transition-colors duration-200"
      >
        <Link href={`/activos/${assetId}/reporte-produccion`}>
          <FileText className="h-4 w-4 mr-2" />
          Reporte Producción
        </Link>
      </Button>
      {ui.canShowEditButton("assets") && (
        <Button
          size="sm"
          variant="outline"
          asChild
          className="w-full sm:w-auto justify-center min-h-[44px] cursor-pointer transition-colors duration-200"
        >
          <Link href={`/activos/${assetId}/editar`}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Link>
        </Button>
      )}
      {!hasComposite && (
        <Button
          size="sm"
          variant="secondary"
          className="w-full sm:w-auto justify-center min-h-[44px] cursor-pointer transition-colors duration-200"
          onClick={() => setOpenCreateComposite(true)}
        >
          Crear Activo Compuesto
        </Button>
      )}
      {hasComposite && (
        <Button
          size="sm"
          variant="outline"
          asChild
          className="w-full sm:w-auto justify-center min-h-[44px] cursor-pointer transition-colors duration-200"
        >
          <Link href={`/checklists/programar?asset=${assetId}`}>
            Programar Checklist Compuesto
          </Link>
        </Button>
      )}
    </div>
  )
}
