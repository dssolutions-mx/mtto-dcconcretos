"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  AlertTriangle,
  Bell,
  CalendarIcon,
  Clock,
} from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
import type { AvailabilityCheck } from "@/lib/planning/planning-types"

interface ScheduleWorkOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: string
  workOrderLabel?: string
  assetId?: string
  assetCode?: string
  onScheduled?: () => void
}

export function ScheduleWorkOrderDialog({
  open,
  onOpenChange,
  workOrderId,
  workOrderLabel,
  assetId,
  assetCode,
  onScheduled,
}: ScheduleWorkOrderDialogProps) {
  const { toast } = useToast()
  const [plannedDate, setPlannedDate] = useState<Date | undefined>()
  const [startTime, setStartTime] = useState("06:00")
  const [durationHours, setDurationHours] = useState(4)
  const [assignedTo, setAssignedTo] = useState<string>("")
  const [technicians, setTechnicians] = useState<Array<{ id: string; name: string }>>([])
  const [saving, setSaving] = useState(false)
  const [availability, setAvailability] = useState<AvailabilityCheck | null>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [notifyOperations, setNotifyOperations] = useState(true)
  const [forceSchedule, setForceSchedule] = useState(false)

  useEffect(() => {
    if (!open) return
    setAvailability(null)
    setForceSchedule(false)
    fetch("/api/work-orders/agenda?from=2000-01-01&to=2099-12-31")
      .then((r) => (r.ok ? r.json() : { technicians: [] }))
      .then((data) => setTechnicians(data.technicians ?? []))
      .catch(() => setTechnicians([]))
  }, [open])

  useEffect(() => {
    if (!open || !assetId || !plannedDate) {
      setAvailability(null)
      return
    }

    const dateStr = format(plannedDate, "yyyy-MM-dd")
    const startsAt = `${dateStr}T${startTime}:00`
    const endDate = new Date(`${dateStr}T${startTime}:00`)
    endDate.setHours(endDate.getHours() + durationHours)
    const endsAt = endDate.toISOString()

    const timer = setTimeout(() => {
      setCheckingAvailability(true)
      fetch(
        `/api/planning/availability?asset_id=${assetId}&starts_at=${encodeURIComponent(startsAt)}&ends_at=${encodeURIComponent(endsAt)}`,
      )
        .then((r) => (r.ok ? r.json() : null))
        .then(setAvailability)
        .catch(() => setAvailability(null))
        .finally(() => setCheckingAvailability(false))
    }, 400)

    return () => clearTimeout(timer)
  }, [open, assetId, plannedDate, startTime, durationHours])

  const handleSave = async () => {
    if (!plannedDate && !assignedTo) {
      toast({
        title: "Datos incompletos",
        description: "Seleccione al menos un técnico o una fecha.",
        variant: "destructive",
      })
      return
    }

    if (availability && !availability.can_schedule && !forceSchedule) {
      toast({
        title: "Conflicto de disponibilidad",
        description: availability.warnings.join(" "),
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const dateStr = plannedDate ? format(plannedDate, "yyyy-MM-dd") : null
      const startsAt = dateStr ? `${dateStr}T${startTime}:00` : null
      let endsAt: string | null = null
      if (startsAt) {
        const end = new Date(startsAt)
        end.setHours(end.getHours() + durationHours)
        endsAt = end.toISOString()
      }

      const body: Record<string, unknown> = {
        confirm_service_window: true,
        notify_operations: notifyOperations,
        estimated_duration_hours: durationHours,
        force_schedule: forceSchedule,
      }
      if (dateStr) body.planned_date = dateStr
      if (startsAt) body.planned_start_at = startsAt
      if (endsAt) body.planned_end_at = endsAt
      if (assignedTo) body.assigned_to = assignedTo

      const res = await fetch(`/api/work-orders/${workOrderId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 409 && data.availability) {
          setAvailability(data.availability)
        }
        throw new Error(data.error ?? "Error al programar")
      }

      toast({
        title: "Trabajo programado",
        description: notifyOperations
          ? "Ventana de servicio creada y operaciones notificadas."
          : "La orden quedó en la agenda del mecánico.",
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

  const applySuggestedSlot = (slot: { starts_at: string; ends_at: string }) => {
    const start = new Date(slot.starts_at)
    setPlannedDate(start)
    setStartTime(format(start, "HH:mm"))
    const hours = (new Date(slot.ends_at).getTime() - start.getTime()) / 3_600_000
    setDurationHours(Math.max(1, Math.round(hours)))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Programar orden de trabajo</DialogTitle>
          <DialogDescription>
            Defina ventana de servicio, mecánico y aviso a operaciones.
            {workOrderLabel ? ` (${workOrderLabel})` : ""}
            {assetCode ? ` · Unidad ${assetCode}` : ""}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label>Fecha</Label>
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
              <Label>Hora inicio</Label>
              <div className="relative">
                <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duración (h)</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value) || 4)}
              />
            </div>
          </div>

          {checkingAvailability && (
            <p className="text-xs text-muted-foreground">Verificando producción…</p>
          )}

          {availability && (
            <div
              className={cn(
                "rounded-md border p-3 text-xs space-y-2",
                availability.can_schedule
                  ? "border-green-200 bg-green-50/50"
                  : "border-amber-200 bg-amber-50/50",
              )}
            >
              <div className="flex items-center gap-2 font-medium">
                {availability.can_schedule ? (
                  <span className="text-green-800">Disponible para servicio</span>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                    <span className="text-amber-900">Conflictos detectados</span>
                  </>
                )}
              </div>
              {availability.warnings.map((w, i) => (
                <p key={i} className="text-muted-foreground">
                  {w}
                </p>
              ))}
              {availability.production_conflicts.length > 0 && (
                <ul className="list-disc pl-4 space-y-0.5">
                  {availability.production_conflicts.slice(0, 5).map((c, i) => (
                    <li key={i}>
                      {c.label} — {c.date} {c.time}
                      {c.volume_m3 != null ? ` (${c.volume_m3} m³)` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {availability.suggested_slots.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {availability.suggested_slots.map((slot, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7"
                      onClick={() => applySuggestedSlot(slot)}
                    >
                      {slot.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="notify-ops"
              checked={notifyOperations}
              onCheckedChange={(v) => setNotifyOperations(v === true)}
            />
            <Label htmlFor="notify-ops" className="text-sm font-normal flex items-center gap-1">
              <Bell className="h-3.5 w-3.5" />
              Notificar a operaciones (unidad fuera de servicio)
            </Label>
          </div>

          {availability && !availability.can_schedule && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="force-schedule"
                checked={forceSchedule}
                onCheckedChange={(v) => setForceSchedule(v === true)}
              />
              <Label htmlFor="force-schedule" className="text-sm font-normal text-amber-800">
                Programar de todos modos (coordinación manual con operaciones)
              </Label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkip}>
            Programar después
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Confirmar ventana de servicio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
