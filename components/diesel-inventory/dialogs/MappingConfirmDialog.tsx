"use client"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface MappingConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalName: string
  targetLabel: string
  onConfirm: () => Promise<void>
}

export function MappingConfirmDialog({ open, onOpenChange, originalName, targetLabel, onConfirm }: MappingConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Mapeo</DialogTitle>
          <DialogDescription>
            ¿Deseas mapear "{originalName}" a "{targetLabel}"?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={async () => { await onConfirm(); onOpenChange(false) }}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


