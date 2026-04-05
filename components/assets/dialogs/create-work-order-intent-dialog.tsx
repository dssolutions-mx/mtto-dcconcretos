"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, Calendar, ChevronRight, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"

export type WorkOrderIntent = "preventive" | "corrective" | "incident_first"

interface CreateWorkOrderIntentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectIntent: (intent: WorkOrderIntent) => void
  /** When false, hides “Reportar incidente primero” (same rule as header “Reportar Incidente”). */
  showIncidentFirstOption?: boolean
}

const rowClass =
  "flex w-full min-h-[44px] items-center gap-3 rounded-lg border border-transparent p-3 text-left transition-colors duration-200 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"

export function CreateWorkOrderIntentDialog({
  open,
  onOpenChange,
  onSelectIntent,
  showIncidentFirstOption = true,
}: CreateWorkOrderIntentDialogProps) {
  /** Close first, then run action on the next frame (HIG: dismiss layer before navigation / second modal). */
  const handleSelect = (intent: WorkOrderIntent) => {
    onOpenChange(false)
    requestAnimationFrame(() => {
      onSelectIntent(intent)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="space-y-2 border-b px-6 py-4 text-left">
          <DialogTitle className="text-lg font-semibold">Tipo de orden de trabajo</DialogTitle>
          <DialogDescription className="text-left text-slate-600">
            Elija cómo desea continuar. El siguiente paso depende del tipo de trabajo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1 p-3">
          <button
            type="button"
            className={cn(rowClass)}
            onClick={() => handleSelect("preventive")}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Calendar className="h-5 w-5 text-foreground" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Mantenimiento preventivo</span>
              <span className="mt-0.5 block text-sm text-slate-600">
                Programar o registrar trabajo planificado por intervalo o calendario
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          </button>

          <button
            type="button"
            className={cn(rowClass)}
            onClick={() => handleSelect("corrective")}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <ClipboardList className="h-5 w-5 text-foreground" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Orden correctiva directa</span>
              <span className="mt-0.5 block text-sm text-slate-600">
                Crear una OT correctiva sin pasar por incidente formal
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          </button>

          {showIncidentFirstOption && (
            <button
              type="button"
              className={cn(rowClass)}
              onClick={() => handleSelect("incident_first")}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <AlertTriangle className="h-5 w-5 text-foreground" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Reportar incidente primero</span>
                <span className="mt-0.5 block text-sm text-slate-600">
                  Registrar el incidente; luego puede generar la OT desde el incidente
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
