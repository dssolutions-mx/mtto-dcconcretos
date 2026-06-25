import { PLANT_EXECUTOR_ROLES } from '@/lib/checklist/executor-roles'
import type { ChecklistSection, ChecklistTemplate } from '@/components/checklists/template-creation/types'

export type PlantaTemplatePreset = Pick<
  ChecklistTemplate,
  'name' | 'frequency' | 'executor_roles' | 'sections'
>

const PLANTA_DAILY_SECTIONS: ChecklistSection[] = [
  {
    title: 'Puntualidad de operadores',
    order_index: 0,
    section_type: 'operator_punctuality',
    punctuality_config: {
      require_production_flag: true,
    },
    items: [],
  },
  {
    title: 'Charla de seguridad',
    order_index: 1,
    section_type: 'security_talk',
    security_config: {
      mode: 'plant_manager',
      require_attendance: true,
      require_topic: true,
      require_reflection: true,
      allow_evidence: false,
    },
    items: [],
  },
  {
    title: 'Evidencia fotográfica (opcional)',
    order_index: 2,
    section_type: 'evidence',
    evidence_config: {
      min_photos: 0,
      max_photos: 5,
      categories: ['Estado general de planta'],
      descriptions: {
        'Estado general de planta': 'Capturar vista general si aplica',
      },
    },
    items: [],
  },
]

const PLANTA_MONTHLY_SECTIONS: ChecklistSection[] = [
  {
    title: 'Cierre de bono de limpieza',
    order_index: 0,
    section_type: 'bonus_closure',
    bonus_closure_config: {
      bonus_type: 'cleanliness',
      deadline_day: 24,
      suggest_eligibility_threshold: 0.8,
    },
    items: [],
  },
]

export function buildPlantaDailyPreset(): PlantaTemplatePreset {
  return {
    name: 'Operaciones de Planta — Diario',
    frequency: 'diario',
    executor_roles: [...PLANT_EXECUTOR_ROLES],
    sections: PLANTA_DAILY_SECTIONS.map((s, i) => ({ ...s, order_index: i })),
  }
}

export function buildPlantaMonthlyPreset(): PlantaTemplatePreset {
  return {
    name: 'Operaciones de Planta — Mensual',
    frequency: 'mensual',
    executor_roles: [...PLANT_EXECUTOR_ROLES],
    sections: PLANTA_MONTHLY_SECTIONS.map((s, i) => ({ ...s, order_index: i })),
  }
}
