import {
  DEFAULT_EXECUTOR_ROLES,
  type ChecklistExecutorRole,
} from '@/lib/checklist/executor-roles'

export interface ChecklistItem {
  id?: string
  description: string
  required: boolean
  order_index: number
  item_type: "check" | "measure" | "text"
  expected_value?: string
  tolerance?: string
}

export interface PunctualityConfig {
  require_production_flag: boolean
}

export interface BonusClosureConfig {
  bonus_type: "cleanliness"
  deadline_day: number
  suggest_eligibility_threshold: number
}

export interface SectionFunnelConfig {
  lane: "maintenance" | "operations_evaluation"
}

export interface ChecklistSection {
  id?: string
  title: string
  order_index: number
  section_type?:
    | "checklist"
    | "evidence"
    | "cleanliness_bonus"
    | "security_talk"
    | "tire_readings"
    | "operator_punctuality"
    | "bonus_closure"
  evidence_config?: { categories?: string[]; [k: string]: unknown }
  cleanliness_config?: unknown
  security_config?: unknown
  punctuality_config?: PunctualityConfig
  bonus_closure_config?: BonusClosureConfig
  tire_readings_config?: unknown
  funnel_config?: SectionFunnelConfig
  items: ChecklistItem[]
}

export interface ChecklistTemplate {
  id?: string
  name: string
  description: string
  model_id: string
  frequency: string
  hours_interval?: number
  executor_roles?: ChecklistExecutorRole[]
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
    executor_roles: [...DEFAULT_EXECUTOR_ROLES],
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
    "name" | "model_id" | "frequency" | "hours_interval" | "sections" | "executor_roles"
  >
): string[] {
  const errors: string[] = []
  const name = (template.name || "").trim()
  if (!name) errors.push("El nombre de la plantilla es requerido")
  if (!template.model_id) errors.push("Selecciona un modelo de equipo")
  if (!template.executor_roles?.length)
    errors.push("Selecciona al menos un rol que pueda ejecutar la plantilla")
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
      section.section_type === "tire_readings" ||
      section.section_type === "operator_punctuality" ||
      section.section_type === "bonus_closure"
    ) {
      // Special sections without checklist items
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
