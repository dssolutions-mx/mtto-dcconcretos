'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  AlertTriangle,
  CircleDot,
  Edit,
  FileText,
  Wrench,
} from 'lucide-react'
import {
  CreateWorkOrderIntentDialog,
  type WorkOrderIntent,
} from '@/components/assets/dialogs/create-work-order-intent-dialog'

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

function useAssetTireCoverageBadge(assetId: string) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/assets/${assetId}/tires`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const subState = data.asset_sub_state as string | undefined
        const coverage = data.coverage as { pct?: number; mounted?: number; total?: number } | undefined
        if (subState === 'no-layout') {
          setLabel('Sin layout')
        } else if (coverage?.total && coverage.total > 0) {
          setLabel(`${coverage.pct ?? 0}%`)
        } else if (subState === 'no-stock') {
          setLabel('Sin stock')
        } else {
          setLabel(null)
        }
      })
      .catch(() => {
        if (!cancelled) setLabel(null)
      })
    return () => {
      cancelled = true
    }
  }, [assetId])

  return label
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
  const tireCoverageLabel = useAssetTireCoverageBadge(assetId)

  const handleWorkOrderIntent = (intent: WorkOrderIntent) => {
    if (intent === 'preventive') {
      router.push(`/activos/${assetId}/mantenimiento/nuevo`)
      return
    }
    if (intent === 'corrective') {
      router.push(`/ordenes/crear?assetId=${assetId}`)
      return
    }
    onReportIncidentClick?.()
  }

  return (
    <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:flex-wrap sm:gap-2">
      {ui.shouldShowInNavigation('work_orders') && (
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
            showIncidentFirstOption={ui.shouldShowInNavigation('maintenance')}
          />
        </>
      )}
      {ui.shouldShowInNavigation('maintenance') && (
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
      {ui.shouldShowInNavigation('assets') && (
        <Button
          size="sm"
          variant="outline"
          asChild
          className="w-full sm:w-auto justify-center min-h-[44px] cursor-pointer transition-colors duration-200"
        >
          <Link href={`/activos/${assetId}/llantas`}>
            <CircleDot className="h-4 w-4 mr-2" />
            Llantas
            {tireCoverageLabel && (
              <Badge
                variant="outline"
                className="ml-2 border-amber-500/50 text-amber-700 dark:text-amber-400"
              >
                {tireCoverageLabel}
              </Badge>
            )}
          </Link>
        </Button>
      )}
      {ui.canShowEditButton?.('assets') && (
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
