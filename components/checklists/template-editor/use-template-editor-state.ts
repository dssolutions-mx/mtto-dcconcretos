/**
 * Shared template state utilities for the checklist template editor and creation wizard.
 * Minimal extraction to avoid massive refactor - provides validation and initial state factory.
 */

export interface ChecklistItem {
  id?: string
  description: string
  required: boolean
  order_index: number
  item_type: "check" | "measure" | "text"
  expected_value?: string
  tolerance?: string
}

export interface ChecklistSection {
  id?: string
  title: string
  order_index: number
  section_type?: "checklist" | "evidence" | "cleanliness_bonus" | "security_talk"
  evidence_config?: { categories?: string[]; [k: string]: unknown }
  cleanliness_config?: unknown
  security_config?: unknown
  items: ChecklistItem[]
}

export interface ChecklistTemplate {
  id?: string
  name: string
  description: string
  model_id: string
  frequency: string
  hours_interval?: number
  sections: ChecklistSection[]
}

/**
 * Creates an initial template for the creation wizard with one default section and item.
 */
export function createInitialTemplate(
  preSelectedModelId?: string
): ChecklistTemplate {
  return {
    name: "",
    description: "",
    model_id: preSelectedModelId || "",
    frequency: "mensual",
    sections: [
      {
        title: "Nueva Sección 1",
        order_index: 0,
        section_type: "checklist",
        items: [
          {
            description: "Nuevo Item",
            required: true,
            order_index: 0,
            item_type: "check",
          },
        ],
      },
    ],
  }
}

/**
 * Validates template data. Returns array of error messages (empty if valid).
 */
export function validateTemplate(
  template: Pick<
    ChecklistTemplate,
    "name" | "model_id" | "frequency" | "hours_interval" | "sections"
  >
): string[] {
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
    errors.push(
      'Indica el intervalo en horas cuando la frecuencia es "Por Horas"'
    )
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
    } else if (section.section_type === "security_talk") {
      // Security talk sections have no items - skip item validation
    } else if (
      (section.section_type === "checklist" ||
        section.section_type === "cleanliness_bonus" ||
        !section.section_type) &&
      (!section.items || section.items.length === 0)
    ) {
      errors.push(
        `La sección "${title || "Sin título"}" debe tener al menos un ítem`
      )
    } else if (section.items?.length) {
      for (const [j, item] of section.items.entries()) {
        const desc = (item.description || "").trim()
        if (!desc)
          errors.push(
            `El ítem ${j + 1} de la sección "${title || "Sin título"}" debe tener descripción`
          )
      }
    }
  }
  return errors
}
