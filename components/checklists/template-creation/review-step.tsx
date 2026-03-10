"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"
import type { ChecklistTemplate } from "./types"

const FREQUENCY_LABELS: Record<string, string> = {
  diario: "Diario",
  semanal: "Semanal",
  mensual: "Mensual",
  horas: "Por Horas",
}

const SECTION_TYPE_LABELS: Record<string, string> = {
  checklist: "Checklist",
  evidence: "Evidencia",
  cleanliness_bonus: "Limpieza",
  security_talk: "Seguridad",
}

interface ReviewStepProps {
  template: ChecklistTemplate
  models: Array<{ id: string; name: string; manufacturer?: string }>
  onEditBasics: () => void
  onEditSections: () => void
  onSaveSuccess?: () => void
}

export function ReviewStep({
  template,
  models,
  onEditBasics,
  onEditSections,
  onSaveSuccess,
}: ReviewStepProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const modelName =
    models.find((m) => m.id === template.model_id)?.name ?? template.model_id
  const frequencyLabel =
    FREQUENCY_LABELS[template.frequency] ?? template.frequency
  const frequencyDisplay =
    template.frequency === "horas" && template.hours_interval
      ? `${frequencyLabel} (cada ${template.hours_interval} h)`
      : frequencyLabel

  const validateTemplate = (): string[] => {
    const errors: string[] = []
    const name = (template.name || "").trim()
    if (!name) errors.push("El nombre de la plantilla es requerido")
    if (!template.model_id) errors.push("Selecciona un modelo de equipo")
    if (!template.sections?.length)
      errors.push("La plantilla debe tener al menos una sección")
    if (
      template.frequency === "horas" &&
      (!template.hours_interval || template.hours_interval < 1)
    ) {
      errors.push('Indica el intervalo en horas cuando la frecuencia es "Por Horas"')
    }
    for (const [i, section] of (template.sections || []).entries()) {
      const title = (section.title || "").trim()
      if (!title) errors.push(`La sección ${i + 1} debe tener un título`)
      if (section.section_type === "evidence") {
        if (!section.evidence_config?.categories?.length) {
          errors.push(
            `La sección de evidencia "${title || "Sin título"}" debe tener al menos una categoría`
          )
        }
      } else if (section.section_type !== "security_talk" && section.items?.length) {
        for (const [j, item] of section.items.entries()) {
          const desc = (item.description || "").trim()
          if (!desc)
            errors.push(
              `El ítem ${j + 1} de la sección "${title || "Sin título"}" debe tener descripción`
            )
        }
      } else if (
        (section.section_type === "checklist" ||
          section.section_type === "cleanliness_bonus" ||
          !section.section_type) &&
        (!section.items || section.items.length === 0)
      ) {
        errors.push(`La sección "${title || "Sin título"}" debe tener al menos un ítem`)
      }
    }
    return errors
  }

  const handleSave = async () => {
    const errors = validateTemplate()
    if (errors.length > 0) {
      toast.error(errors[0])
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()

      const { data: newTemplate, error } = await supabase
        .from("checklists")
        .insert({
          name: template.name,
          description: template.description || null,
          model_id: template.model_id,
          frequency: template.frequency,
          hours_interval: template.hours_interval ?? null,
        })
        .select()
        .single()

      if (error) throw error

      for (let i = 0; i < template.sections.length; i++) {
        const section = template.sections[i]

        const { data: newSection, error: sectionError } = await supabase
          .from("checklist_sections")
          .insert({
            checklist_id: newTemplate.id,
            title: section.title,
            order_index: i,
            section_type: section.section_type || "checklist",
            evidence_config: section.evidence_config || null,
            cleanliness_config: section.cleanliness_config || null,
            security_config: section.security_config || null,
          })
          .select("id")
          .single()

        if (sectionError) throw sectionError

        if (
          section.section_type === "checklist" ||
          section.section_type === "cleanliness_bonus" ||
          !section.section_type
        ) {
          for (let j = 0; j < (section.items || []).length; j++) {
            const item = section.items[j]
            await supabase.from("checklist_items").insert({
              section_id: newSection.id,
              description: item.description,
              required: item.required ?? true,
              order_index: j,
              item_type: item.item_type || "check",
              expected_value: item.expected_value || null,
              tolerance: item.tolerance || null,
            })
          }
        }
      }

      toast.success("Plantilla creada")
      onSaveSuccess?.()
      router.push(`/checklists/${newTemplate.id}`)
    } catch (err) {
      console.error("Error saving template:", err)
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Paso 3 de 3: Revisar</p>
      <p className="text-sm text-muted-foreground">
        Revisa tu plantilla antes de guardar.
      </p>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Información básica</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditBasics}
                aria-label="Editar información básica"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Nombre:</span>{" "}
              {template.name || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Modelo:</span>{" "}
              {modelName}
            </p>
            <p>
              <span className="text-muted-foreground">Frecuencia:</span>{" "}
              {frequencyDisplay}
            </p>
            {template.description && (
              <p>
                <span className="text-muted-foreground">Descripción:</span>{" "}
                {template.description}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Secciones</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditSections}
                aria-label="Editar secciones"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(template.sections || []).map((section, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>{section.title || `Sección ${i + 1}`}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {SECTION_TYPE_LABELS[section.section_type || "checklist"] ??
                        "Checklist"}
                    </Badge>
                    <span className="text-muted-foreground">
                      {(section.items || []).length} ítems
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full"
        size="lg"
        aria-label="Guardar plantilla"
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          "Guardar plantilla"
        )}
      </Button>
    </div>
  )
}
