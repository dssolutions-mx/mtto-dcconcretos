"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DepartmentSelector } from "@/components/ui/department-selector"
import {
  SLA_IMPACT_OPTIONS,
  type IncidentSlaTarget,
  type SlaTargetInput,
} from "@/lib/incidents/incident-sla-targets"

type PlantOption = { id: string; name: string; code?: string }

const EMPTY_FORM = {
  name: "",
  priority: "100",
  is_active: true,
  plant_id: "",
  match_incident_type: "",
  match_impact: "",
  match_department_id: "",
  target_ack_hours: "24",
  target_schedule_hours: "48",
  target_resolve_hours: "168",
}

type SlaTargetFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: IncidentSlaTarget | null
  plants: PlantOption[]
  saving: boolean
  onSubmit: (payload: SlaTargetInput) => Promise<void>
}

export function SlaTargetFormDialog({
  open,
  onOpenChange,
  target,
  plants,
  saving,
  onSubmit,
}: SlaTargetFormDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!open) return
    if (target) {
      setForm({
        name: target.name,
        priority: String(target.priority),
        is_active: target.is_active,
        plant_id: target.plant_id ?? "",
        match_incident_type: target.match_incident_type ?? "",
        match_impact: target.match_impact ?? "",
        match_department_id: target.match_department_id ?? "",
        target_ack_hours: String(target.target_ack_hours),
        target_schedule_hours: String(target.target_schedule_hours),
        target_resolve_hours: String(target.target_resolve_hours),
      })
      return
    }
    setForm(EMPTY_FORM)
  }, [open, target])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await onSubmit({
      name: form.name.trim(),
      priority: Number(form.priority),
      is_active: form.is_active,
      plant_id: form.plant_id || null,
      match_incident_type: form.match_incident_type.trim() || null,
      match_impact: form.match_impact || null,
      match_department_id: form.match_department_id || null,
      target_ack_hours: Number(form.target_ack_hours),
      target_schedule_hours: Number(form.target_schedule_hours),
      target_resolve_hours: Number(form.target_resolve_hours),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{target ? "Editar objetivo SLA" : "Nuevo objetivo SLA"}</DialogTitle>
          <DialogDescription>
            Define criterios de coincidencia y tiempos objetivo. Menor prioridad numérica = mayor
            precedencia.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sla-name">Nombre</Label>
            <Input
              id="sla-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ej. Impacto alto — Planta Norte"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sla-priority">Prioridad</Label>
              <Input
                id="sla-priority"
                type="number"
                min={0}
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({ ...current, priority: event.target.value }))
                }
                required
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Switch
                id="sla-active"
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, is_active: checked }))
                }
              />
              <Label htmlFor="sla-active">Activo</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Planta (opcional)</Label>
            <Select
              value={form.plant_id || "__any__"}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, plant_id: value === "__any__" ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las plantas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Todas las plantas</SelectItem>
                {plants.map((plant) => (
                  <SelectItem key={plant.id} value={plant.id}>
                    {plant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Impacto (opcional)</Label>
            <Select
              value={form.match_impact || "__any__"}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  match_impact: value === "__any__" ? "" : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Cualquier impacto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Cualquier impacto</SelectItem>
                {SLA_IMPACT_OPTIONS.map((impact) => (
                  <SelectItem key={impact} value={impact}>
                    {impact}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DepartmentSelector
            label="Departamento (opcional)"
            value={form.match_department_id}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, match_department_id: value }))
            }
            canonicalOnly
            placeholder="Cualquier departamento"
          />

          <div className="space-y-2">
            <Label htmlFor="sla-type">Tipo de incidente (opcional)</Label>
            <Input
              id="sla-type"
              value={form.match_incident_type}
              onChange={(event) =>
                setForm((current) => ({ ...current, match_incident_type: event.target.value }))
              }
              placeholder="Ej. falla mecánica"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sla-ack">Atención (h)</Label>
              <Input
                id="sla-ack"
                type="number"
                min={1}
                value={form.target_ack_hours}
                onChange={(event) =>
                  setForm((current) => ({ ...current, target_ack_hours: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sla-schedule">Programación (h)</Label>
              <Input
                id="sla-schedule"
                type="number"
                min={1}
                value={form.target_schedule_hours}
                onChange={(event) =>
                  setForm((current) => ({ ...current, target_schedule_hours: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sla-resolve">Resolución (h)</Label>
              <Input
                id="sla-resolve"
                type="number"
                min={1}
                value={form.target_resolve_hours}
                onChange={(event) =>
                  setForm((current) => ({ ...current, target_resolve_hours: event.target.value }))
                }
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : target ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
