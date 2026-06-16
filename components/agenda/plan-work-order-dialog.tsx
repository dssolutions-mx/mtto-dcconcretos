"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, ExternalLink } from "lucide-react"
import Link from "next/link"
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
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { ServiceOrderPriority, WorkOrderStatus } from "@/types"
import { ORIGIN_LABELS, type AgendaWorkOrder } from "@/lib/agenda/agenda-utils"

export type PlanWorkOrderSummary = Pick<
  AgendaWorkOrder,
  | "id"
  | "order_id"
  | "description"
  | "priority"
  | "status"
  | "planned_date"
  | "assigned_to"
  | "asset_code"
  | "asset_name"
  | "origin"
  | "technician_name"
>

interface PlanWorkOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrder: PlanWorkOrderSummary | null
  defaultPlannedDate?: string
  onSaved?: () => void
}

const STATUS_OPTIONS = [
  WorkOrderStatus.Pending,
  WorkOrderStatus.Programmed,
  WorkOrderStatus.WaitingParts,
] as const

const PRIORITY_OPTIONS = [
  ServiceOrderPriority.Low,
  ServiceOrderPriority.Medium,
  ServiceOrderPriority.High,
  ServiceOrderPriority.Critical,
] as const

export function PlanWorkOrderDialog({
  open,
  onOpenChange,
  workOrder,
  defaultPlannedDate,
  onSaved,
}: PlanWorkOrderDialogProps) {
  const { toast } = useToast()
  const [plannedDate, setPlannedDate] = useState<Date | undefined>()
  const [assignedTo, setAssignedTo] = useState<string>("")
  const [status, setStatus] = useState<string>(WorkOrderStatus.Pending)
  const [priority, setPriority] = useState<string>(ServiceOrderPriority.Medium)
  const [technicians, setTechnicians] = useState<Array<{ id: string; name: string }>>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !workOrder) return

    setPlannedDate(
      workOrder.planned_date
        ? parseISO(workOrder.planned_date.slice(0, 10))
        : defaultPlannedDate
          ? parseISO(defaultPlannedDate)
          : undefined,
    )
    setAssignedTo(workOrder.assigned_to ?? "")
    setStatus(workOrder.status || WorkOrderStatus.Pending)
    setPriority(workOrder.priority || ServiceOrderPriority.Medium)

    fetch("/api/work-orders/agenda?technicians_only=true&from=1970-01-01&to=1970-01-01")
      .then((r) => (r.ok ? r.json() : { technicians: [] }))
      .then((data) => setTechnicians(data.technicians ?? []))
      .catch(() => setTechnicians([]))
  }, [open, workOrder, defaultPlannedDate])

  const handleSave = async () => {
    if (!workOrder) return

    if (!plannedDate && !assignedTo && !workOrder.planned_date && !workOrder.assigned_to) {
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
      body.assigned_to = assignedTo || null
      if (status) {
        body.status = status
      }
      if (priority) {
        body.priority = priority
      }

      const res = await fetch(`/api/work-orders/${workOrder.id}/schedule`, {
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
        description: "La orden quedó actualizada en la agenda.",
      })
      onSaved?.()
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

  if (!workOrder) return null

  const assetLabel = workOrder.asset_code ?? workOrder.asset_name ?? "Sin activo"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Planificar orden de trabajo</DialogTitle>
          <DialogDescription>
            Asigne fecha, técnico y estado sin abrir el formulario completo de la OT.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold font-mono">{workOrder.order_id}</span>
            <Badge variant="outline" className="text-xs">
              {ORIGIN_LABELS[workOrder.origin]}
            </Badge>
          </div>
          <p className="text-muted-foreground">{assetLabel}</p>
          <p className="line-clamp-3">{workOrder.description}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 py-1">
          <div className="space-y-2 sm:col-span-2">
            <Label>Mecánico</Label>
            <Select value={assignedTo || "none"} onValueChange={(v) => setAssignedTo(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar técnico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
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

          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Prioridad</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/ordenes/${workOrder.id}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver OT completa
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar planificación"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
