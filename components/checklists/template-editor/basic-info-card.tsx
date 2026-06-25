"use client"

import { memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CHECKLIST_EXECUTOR_ROLE_OPTIONS,
  EXECUTOR_ROLE_LABELS,
  type ChecklistExecutorRole,
} from "@/lib/checklist/executor-roles"

interface BasicInfoCardProps {
  templateName: string
  templateDescription: string
  name: string
  description: string
  modelId: string
  frequency: string
  hoursInterval?: number
  executorRoles: ChecklistExecutorRole[]
  models: Array<{
    id: string
    name: string
    manufacturer?: string
    maintenance_unit?: string | null
  }>
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onModelChange: (value: string) => void
  onFrequencyChange: (value: string) => void
  onHoursIntervalChange: (value: number | undefined) => void
  onExecutorRolesChange: (roles: ChecklistExecutorRole[]) => void
}

export const BasicInfoCard = memo(function BasicInfoCard({
  templateName,
  templateDescription,
  name,
  description,
  modelId,
  frequency,
  hoursInterval,
  executorRoles,
  models,
  onNameChange,
  onDescriptionChange,
  onModelChange,
  onFrequencyChange,
  onHoursIntervalChange,
  onExecutorRolesChange,
}: BasicInfoCardProps) {
  const toggleRole = (role: ChecklistExecutorRole, checked: boolean) => {
    if (checked) {
      if (!executorRoles.includes(role)) {
        onExecutorRolesChange([...executorRoles, role])
      }
      return
    }
    if (executorRoles.length <= 1) return
    onExecutorRolesChange(executorRoles.filter((r) => r !== role))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información Básica</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Plantilla</Label>
            <Input
              id="name"
              value={templateName || name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Nombre de la plantilla"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Modelo de Equipo</Label>
            <Select value={modelId} onValueChange={onModelChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar modelo" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name} ({model.manufacturer})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            value={templateDescription || description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Descripción de la plantilla"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="frequency">Frecuencia</Label>
            <Select value={frequency} onValueChange={onFrequencyChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diario</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="horas">Por Horas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {frequency === "horas" && (
            <div className="space-y-2">
              <Label htmlFor="hours">Intervalo en Horas</Label>
              <Input
                id="hours"
                type="number"
                value={hoursInterval ?? ""}
                onChange={(e) =>
                  onHoursIntervalChange(parseInt(e.target.value) || undefined)
                }
                placeholder="Horas"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Roles que pueden ejecutar</Label>
          <p className="text-xs text-muted-foreground">
            Define quién puede completar checklists generados con esta plantilla.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECKLIST_EXECUTOR_ROLE_OPTIONS.map((role) => (
              <label
                key={role}
                className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={executorRoles.includes(role)}
                  onCheckedChange={(checked) =>
                    toggleRole(role, checked === true)
                  }
                />
                <span>{EXECUTOR_ROLE_LABELS[role]}</span>
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
