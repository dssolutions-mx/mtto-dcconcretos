"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ExecutorRolesBadges } from "@/components/checklists/executor-roles-badges"
import { isPlantaAsset } from "@/lib/checklist/executor-roles"
import { SearchableCombobox } from "./searchable-combobox"
import {
  collectSpecialSectionTypes,
  frequencyLabel,
  SPECIAL_SECTION_LABELS,
} from "./schedule-labels"
import type { ScheduleAsset, ScheduleTemplate } from "./types"

type TemplatePickerProps = {
  value: string
  onValueChange: (value: string) => void
  templates: ScheduleTemplate[]
  selectedAsset: ScheduleAsset | null
  loading?: boolean
  id?: string
}

function templateMatchesAsset(
  template: ScheduleTemplate,
  asset: ScheduleAsset | null
): boolean {
  if (!asset?.model_id) return true
  if (!template.model_id) return false
  return template.model_id === asset.model_id
}

export function TemplatePicker({
  value,
  onValueChange,
  templates,
  selectedAsset,
  loading = false,
  id = "templateSelection",
}: TemplatePickerProps) {
  const [frequencyFilter, setFrequencyFilter] = useState<string>("all")

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === value) ?? null,
    [templates, value]
  )

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (frequencyFilter !== "all" && template.frequency !== frequencyFilter) {
        return false
      }
      return true
    })
  }, [templates, frequencyFilter])

  const options = useMemo(() => {
    const compatible: typeof filteredTemplates = []
    const other: typeof filteredTemplates = []

    for (const template of filteredTemplates) {
      if (templateMatchesAsset(template, selectedAsset)) {
        compatible.push(template)
      } else {
        other.push(template)
      }
    }

    const toOption = (template: ScheduleTemplate, group?: string) => {
      const specialTypes = collectSpecialSectionTypes(template.checklist_sections)
      const modelName = template.equipment_models?.name
      const plantaTemplate = isPlantaAsset({
        modelId: template.model_id,
        maintenanceUnit: template.equipment_models?.maintenance_unit,
      })

      return {
        value: template.id,
        group,
        label: template.name,
        keywords: `${template.name} ${template.frequency} ${modelName ?? ""}`,
        description: [
          frequencyLabel(template.frequency),
          modelName,
          specialTypes.length
            ? specialTypes
                .map((type) => SPECIAL_SECTION_LABELS[type] ?? type)
                .join(" · ")
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        badge: plantaTemplate ? (
          <Badge variant="outline" className="text-[10px] border-sky-300 text-sky-800">
            PLANTA
          </Badge>
        ) : undefined,
        disabled: selectedAsset ? !templateMatchesAsset(template, selectedAsset) : false,
      }
    }

    if (!selectedAsset) {
      return filteredTemplates.map((template) => toOption(template))
    }

    return [
      ...compatible.map((template) => toOption(template, "Compatibles con el activo")),
      ...other.map((template) =>
        toOption(template, "Otros modelos (no compatibles)")
      ),
    ]
  }, [filteredTemplates, selectedAsset])

  const compatibleCount = useMemo(() => {
    if (!selectedAsset) return filteredTemplates.length
    return filteredTemplates.filter((template) =>
      templateMatchesAsset(template, selectedAsset)
    ).length
  }, [filteredTemplates, selectedAsset])

  const specialTypes = collectSpecialSectionTypes(
    selectedTemplate?.checklist_sections
  )

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${id}-frequency`}>Filtrar por frecuencia</Label>
        <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
          <SelectTrigger id={`${id}-frequency`} className="sm:max-w-xs">
            <SelectValue placeholder="Todas las frecuencias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las frecuencias</SelectItem>
            <SelectItem value="diario">Diario</SelectItem>
            <SelectItem value="semanal">Semanal</SelectItem>
            <SelectItem value="mensual">Mensual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={id}>Plantilla</Label>
        <SearchableCombobox
          id={id}
          value={value}
          onValueChange={onValueChange}
          options={options}
          loading={loading}
          placeholder="Seleccionar plantilla"
          searchPlaceholder="Buscar por nombre, modelo o frecuencia…"
          emptyMessage="No hay plantillas con estos filtros."
        />
      </div>

      {selectedAsset && filteredTemplates.length > 0 && compatibleCount === 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          No hay plantillas para el modelo de este activo. Cree una plantilla o elija otro activo.
        </p>
      ) : null}

      {selectedTemplate ? (
        <div className="space-y-2">
          <ExecutorRolesBadges
            roles={selectedTemplate.executor_roles}
            className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
          />
          {specialTypes.length > 0 ? (
            <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Secciones especiales
              </p>
              <div className="flex flex-wrap gap-1.5">
                {specialTypes.map((type) => (
                  <Badge key={type} variant="secondary" className="text-[11px]">
                    {SPECIAL_SECTION_LABELS[type] ?? type}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
