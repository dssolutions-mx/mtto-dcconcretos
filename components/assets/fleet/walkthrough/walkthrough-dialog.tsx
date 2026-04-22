'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Placeholder: keyboard stepper for verification walkthrough (expand in follow-up). */
export function VerificationWalkthroughDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recorrido de verificación</DialogTitle>
          <DialogDescription>
            Próximamente: recorrido guiado (Y/N/S) por campos pendientes de confianza.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
