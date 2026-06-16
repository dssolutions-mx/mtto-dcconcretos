"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface ScheduleWorkOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: string
  workOrderLabel?: string
  onScheduled?: () => void
}

export function ScheduleWorkOrderDialog({
  open,
  onOpenChange,
  workOrderId,
  workOrderLabel,
  onScheduled,
}: ScheduleWorkOrderDialogProps) {
  const { toast } = useToast()
  const [plannedDate, setPlannedDate] = useState<Date | undefined>()
  const [assignedTo, setAssignedTo] = useState<string>("")
  const [technicians, setTechnicians] = useState<Array<{ id: string; name: string }>>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch("/api/work-orders/agenda?from=2000-01-01&to=2099-12-31")
      .then((r) => (r.ok ? r.json() : { technicians: [] }))
      .then((data) => setTechnicians(data.technicians ?? []))
      .catch(() => setTechnicians([]))
  }, [open])

  const handleSave = async () => {
    if (!plannedDate && !assignedTo) {
      toast({
        title: "Datos incompletos",
        description: "Seleccione al menos un técnico o una fecha.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const body: Record<string, string | null> = {}
      if (plannedDate) {
        body.planned_date = format(plannedDate, "yyyy-MM-dd")
      }
      if (assignedTo) {
        body.assigned_to = assignedTo
      }

      const res = await fetch(`/api/work-orders/${workOrderId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Error al programar")
      }

      toast({
        title: "Trabajo programado",
        description: "La orden quedó en la agenda del mecánico.",
      })
      onScheduled?.()
      onOpenChange(false)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo programar",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    onOpenChange(false)
    window.location.href = `/ordenes/${workOrderId}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Programar orden de trabajo</DialogTitle>
          <DialogDescription>
            Asigne mecánico y fecha para que el trabajo aparezca en la agenda.
            {workOrderLabel ? ` (${workOrderLabel})` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Mecánico</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar técnico" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fecha programada</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !plannedDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {plannedDate
                    ? format(plannedDate, "PPP", { locale: es })
                    : "Elegir fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={plannedDate}
                  onSelect={setPlannedDate}
                  locale={es}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <p className="text-xs text-muted-foreground">
            Integración con producción (disponibilidad de unidades en planta) queda
            documentada para una fase posterior vía Cotizador.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkip}>
            Programar después
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar en agenda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
