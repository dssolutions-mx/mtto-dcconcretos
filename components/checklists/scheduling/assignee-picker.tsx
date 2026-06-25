"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { EXECUTOR_ROLE_LABELS, isPlantaAsset, PLANT_EXECUTOR_ROLES } from "@/lib/checklist/executor-roles"
import { SearchableCombobox } from "./searchable-combobox"
import type { ScheduleAsset, ScheduleUser } from "./types"

type AssigneePickerProps = {
  value: string
  onValueChange: (value: string) => void
  users: ScheduleUser[]
  selectedAsset: ScheduleAsset | null
  loading?: boolean
  id?: string
}

function userDisplayName(user: ScheduleUser): string {
  return `${user.nombre ?? ""} ${user.apellido ?? ""}`.trim() || "Sin nombre"
}

function roleLabel(role: string | null | undefined): string {
  if (!role) return "Sin rol"
  return EXECUTOR_ROLE_LABELS[role as keyof typeof EXECUTOR_ROLE_LABELS] ?? role
}

export function AssigneePicker({
  value,
  onValueChange,
  users,
  selectedAsset,
  loading = false,
  id = "technicianSelection",
}: AssigneePickerProps) {
  const isPlanta = selectedAsset
    ? isPlantaAsset({
        modelId: selectedAsset.model_id,
        maintenanceUnit: selectedAsset.equipment_models?.maintenance_unit,
      })
    : false

  const assetPlantId = selectedAsset?.plant_id ?? null

  const options = useMemo(() => {
    const suggested: ScheduleUser[] = []
    const others: ScheduleUser[] = []

    for (const user of users) {
      const isSuggested =
        isPlanta &&
        assetPlantId &&
        user.plant_id === assetPlantId &&
        user.role &&
        (PLANT_EXECUTOR_ROLES as readonly string[]).includes(user.role)

      if (isSuggested) {
        suggested.push(user)
      } else {
        others.push(user)
      }
    }

    const toOption = (user: ScheduleUser, group?: string) => ({
      value: user.id,
      group,
      label: userDisplayName(user),
      keywords: `${user.nombre ?? ""} ${user.apellido ?? ""} ${user.role ?? ""}`,
      description: roleLabel(user.role),
      badge: user.role ? (
        <Badge variant="outline" className="text-[10px] font-normal">
          {roleLabel(user.role)}
        </Badge>
      ) : undefined,
    })

    if (!isPlanta || suggested.length === 0) {
      return users.map((user) => toOption(user))
    }

    return [
      ...suggested.map((user) =>
        toOption(user, "Sugeridos para operaciones de planta")
      ),
      ...others.map((user) => toOption(user, "Otros usuarios")),
    ]
  }, [assetPlantId, isPlanta, users])

  const selectedUser = users.find((user) => user.id === value) ?? null

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Técnico asignado</Label>
      <SearchableCombobox
        id={id}
        value={value}
        onValueChange={onValueChange}
        options={options}
        loading={loading}
        placeholder="Seleccionar técnico"
        searchPlaceholder="Buscar por nombre o rol…"
        emptyMessage="No hay usuarios disponibles."
      />
      {isPlanta ? (
        <p className="text-xs text-muted-foreground">
          Para checklists de planta se sugieren dosificador y jefe de planta de la misma planta.
        </p>
      ) : null}
      {selectedUser ? (
        <p className="text-xs text-muted-foreground">
          Rol: {roleLabel(selectedUser.role)}
          {selectedUser.plant_id && assetPlantId === selectedUser.plant_id
            ? " · Misma planta que el activo"
            : ""}
        </p>
      ) : null}
    </div>
  )
}
