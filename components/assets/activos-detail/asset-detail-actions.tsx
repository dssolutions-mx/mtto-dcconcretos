"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  AlertTriangle,
  Edit,
  FileText,
  Wrench,
} from "lucide-react"
import {
  CreateWorkOrderIntentDialog,
  type WorkOrderIntent,
} from "@/components/assets/dialogs/create-work-order-intent-dialog"

interface AssetDetailActionsProps {
  assetId: string
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
  hasComposite,
  setOpenCreateComposite,
  onReportIncidentClick,
  ui,
}: AssetDetailActionsProps) {
  const router = useRouter()
  const [workOrderIntentOpen, setWorkOrderIntentOpen] = useState(false)

  const handleWorkOrderIntent = (intent: WorkOrderIntent) => {
    if (intent === "preventive") {
      router.push(`/activos/${assetId}/mantenimiento/nuevo`)
      return
    }
    if (intent === "corrective") {
      router.push(`/ordenes/crear?assetId=${assetId}`)
      return
    }
    onReportIncidentClick?.()
  }

  return (
    <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:flex-wrap sm:gap-2">
      {ui.shouldShowInNavigation("work_orders") && (
        <>
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto justify-center min-h-[44px] cursor-pointer transition-colors duration-200 bg-sky-700 hover:bg-sky-800 text-white"
            onClick={() => setWorkOrderIntentOpen(true)}
          >
            <Wrench className="h-4 w-4 mr-2" />
            Crear OT
          </Button>
          <CreateWorkOrderIntentDialog
            open={workOrderIntentOpen}
            onOpenChange={setWorkOrderIntentOpen}
            onSelectIntent={handleWorkOrderIntent}
            showIncidentFirstOption={ui.shouldShowInNavigation("maintenance")}
          />
        </>
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
