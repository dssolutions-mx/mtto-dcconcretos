"use client"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Save } from "lucide-react"

interface ChangeSummaryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  changeSummary: string
  onChangeSummary: (value: string) => void
  onSave: () => void
  saving: boolean
}

export function ChangeSummaryDialog({
  open,
  onOpenChange,
  changeSummary,
  onChangeSummary,
  onSave,
  saving,
}: ChangeSummaryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guardar Cambios</DialogTitle>
          <DialogDescription>
            Describe los cambios realizados en esta versión de la plantilla
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="changeSummary">Resumen de Cambios</Label>
            <Textarea
              id="changeSummary"
              value={changeSummary}
              onChange={(e) => onChangeSummary(e.target.value)}
              placeholder="Ej: Agregué nueva sección de verificación de limpieza, eliminé item duplicado de accesorios..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              onChangeSummary('')
            }}
          >
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
