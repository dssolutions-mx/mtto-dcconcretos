"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, CheckSquare, Ruler, Type } from "lucide-react"
import { TireReadingsConfigEditor } from "@/components/checklists/tire-readings-config-editor"
import { DEFAULT_TIRE_READINGS_CONFIG } from "@/lib/tires/tire-readings-validation"
import type { ChecklistSection, ChecklistItem } from "./types"

function getItemTypeIcon(type: string) {
  switch (type) {
    case "measure":
      return <Ruler className="h-4 w-4 text-muted-foreground" />
    case "text":
      return <Type className="h-4 w-4 text-muted-foreground" />
    default:
      return <CheckSquare className="h-4 w-4 text-muted-foreground" />
  }
}

interface SectionEditorBodyProps {
  section: ChecklistSection
  sectionIndex: number
  onTitleChange: (title: string) => void
  onConfigChange?: (updates: Partial<ChecklistSection>) => void
  onAddItem: () => void
  onDeleteItem: (itemIndex: number) => void
  onUpdateItem: (itemIndex: number, updates: Partial<ChecklistItem>) => void
}

export function SectionEditorBody({
  section,
  sectionIndex,
  onTitleChange,
  onConfigChange,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
}: SectionEditorBodyProps) {
  const sectionType = section.section_type || "checklist"
  const items = section.items || []

  if (sectionType === "evidence") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Título de la sección</Label>
          <Input
            value={section.title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Título de la sección"
          />
        </div>
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p>
            Sección de evidencia fotográfica. Configura categorías y descripciones
            en el editor después de guardar.
          </p>
        </div>
      </div>
    )
  }
  if (sectionType === "security_talk") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Título de la sección</Label>
          <Input
            value={section.title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Título de la sección"
          />
        </div>
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p>
            Sección de charla de seguridad. Configura opciones en el editor después
            de guardar.
          </p>
        </div>
      </div>
    )
  }
  if (sectionType === "operator_punctuality") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Título de la sección</Label>
          <Input
            value={section.title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Puntualidad de operadores"
          />
        </div>
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p>
            Sección de puntualidad diaria. El dosificador registrará producción y
            asistencia al ejecutar el checklist.
          </p>
        </div>
      </div>
    )
  }
  if (sectionType === "bonus_closure") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Título de la sección</Label>
          <Input
            value={section.title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Cierre de bono mensual"
          />
        </div>
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p>
            Cierre mensual de elegibilidad de bono de limpieza. Use plantilla con
            frecuencia <strong>mensual</strong> y modelo PLANTA.
          </p>
        </div>
      </div>
    )
  }
  if (sectionType === "tire_readings") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Título de la sección</Label>
          <Input
            value={section.title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Inspección de llantas"
          />
        </div>
        <TireReadingsConfigEditor
          config={section.tire_readings_config ?? DEFAULT_TIRE_READINGS_CONFIG}
          onChange={(tire_readings_config) =>
            onConfigChange?.({ tire_readings_config })
          }
        />
        <p className="text-sm text-muted-foreground">
          Al ejecutar el checklist se capturan lecturas según el modo configurado para cada llanta montada.
        </p>
      </div>
    )
  }
  if (sectionType === "cleanliness_bonus") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Título de la sección</Label>
          <Input
            value={section.title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Título de la sección"
          />
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          Verificación de limpieza (checklist + fotos). Items a verificar:
        </p>
        {items.map((item, itemIndex) => (
          <div
            key={itemIndex}
            className="flex flex-wrap items-center gap-3 py-3 border-b border-border/50 last:border-b-0"
          >
            <Input
              value={item.description}
              onChange={(e) =>
                onUpdateItem(itemIndex, { description: e.target.value })
              }
              placeholder="Descripción del item"
              className="flex-1 min-w-[180px]"
            />
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Switch
                  checked={item.required}
                  onCheckedChange={(checked) =>
                    onUpdateItem(itemIndex, { required: checked })
                  }
                />
                <Label className="text-sm text-muted-foreground">Requerido</Label>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDeleteItem(itemIndex)}
                aria-label="Eliminar item"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={onAddItem}
          className="w-full border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Item de Limpieza
        </Button>
      </div>
    )
  }

  // Checklist type
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Título de la sección</Label>
        <Input
          value={section.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Título de la sección"
        />
      </div>
      <div className="space-y-2">
        <Label>Embudo al completar</Label>
        <Select
          value={section.funnel_config?.lane || "maintenance"}
          onValueChange={(value: "maintenance" | "operations_evaluation") =>
            onConfigChange?.({
              funnel_config: { lane: value },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="maintenance">Mantenimiento (OT / incidencias)</SelectItem>
            <SelectItem value="operations_evaluation">
              Operaciones / RH (sin OT ni incidencias)
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Use Operaciones para evaluaciones como limpieza de barcos o revisiones
          generales de planta que no deben generar órdenes de trabajo.
        </p>
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Items</h4>
        {items.map((item, itemIndex) => (
          <div
            key={itemIndex}
            className="py-3 border-b border-border/50 last:border-b-0 space-y-2"
          >
            <div className="flex items-center gap-2">
              {getItemTypeIcon(item.item_type)}
              <Input
                value={item.description}
                onChange={(e) =>
                  onUpdateItem(itemIndex, { description: e.target.value })
                }
                placeholder="Descripción del item"
                className="flex-1"
              />
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={item.required}
                  onCheckedChange={(checked) =>
                    onUpdateItem(itemIndex, { required: checked })
                  }
                />
                <Label className="text-sm text-muted-foreground">Requerido</Label>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDeleteItem(itemIndex)}
                aria-label="Eliminar item"
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-6">
              <Select
                value={item.item_type}
                onValueChange={(value: "check" | "measure" | "text") =>
                  onUpdateItem(itemIndex, { item_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check">Verificación</SelectItem>
                  <SelectItem value="measure">Medición</SelectItem>
                  <SelectItem value="text">Texto</SelectItem>
                </SelectContent>
              </Select>
              {(item.item_type === "measure" || item.item_type === "text") && (
                <>
                  <Input
                    value={item.expected_value || ""}
                    onChange={(e) =>
                      onUpdateItem(itemIndex, {
                        expected_value: e.target.value,
                      })
                    }
                    placeholder="Valor esperado"
                  />
                  <Input
                    value={item.tolerance || ""}
                    onChange={(e) =>
                      onUpdateItem(itemIndex, { tolerance: e.target.value })
                    }
                    placeholder="Tolerancia"
                  />
                </>
              )}
            </div>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={onAddItem}
          className="w-full border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Item
        </Button>
      </div>
    </div>
  )
}
