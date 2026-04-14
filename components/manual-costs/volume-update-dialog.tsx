'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { DistributedBatchView } from '@/components/manual-costs/distributed-batch-view'

type VolumeUpdateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  month: string
  /** After a successful batch volume sync */
  onSynced?: () => void
}

export function VolumeUpdateSheet({ open, onOpenChange, month, onSynced }: VolumeUpdateSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[min(1200px,96vw)] overflow-y-auto flex flex-col"
      >
        <SheetHeader className="text-left shrink-0">
          <SheetTitle>Sincronizar distribución por volumen</SheetTitle>
          <SheetDescription>
            Los costos manuales distribuidos por volumen se comparan con el cotizador. Actualiza para
            guardar volúmenes y recalcular montos por planta.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 flex-1 min-h-0">
          <DistributedBatchView month={month} embedded onBatchSuccess={onSynced} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
