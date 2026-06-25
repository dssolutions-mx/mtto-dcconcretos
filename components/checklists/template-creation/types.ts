export interface ChecklistItem {
  id?: string
  description: string
  required: boolean
  order_index: number
  item_type: "check" | "measure" | "text"
  expected_value?: string
  tolerance?: string
}

export interface EvidenceConfig {
  min_photos: number
  max_photos: number
  categories: string[]
  descriptions: Record<string, string>
}

export interface CleanlinessConfig {
  min_photos: number
  max_photos: number
  areas: string[]
  descriptions: Record<string, string>
}

export interface SecurityConfig {
  mode: string
  require_attendance: boolean
  require_topic: boolean
  require_reflection: boolean
  allow_evidence: boolean
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

import type { TireReadingsSectionConfig } from "@/types/tires"

export interface ChecklistSection {
  id?: string
  title: string
  order_index: number
  section_type?: "checklist" | "evidence" | "cleanliness_bonus" | "security_talk" | "tire_readings" | "operator_punctuality" | "bonus_closure"
  evidence_config?: EvidenceConfig
  cleanliness_config?: CleanlinessConfig
  security_config?: SecurityConfig
  punctuality_config?: PunctualityConfig
  bonus_closure_config?: BonusClosureConfig
  tire_readings_config?: TireReadingsSectionConfig
  funnel_config?: SectionFunnelConfig
  items: ChecklistItem[]
}

import {
  type ChecklistExecutorRole,
} from "@/lib/checklist/executor-roles"

export interface ChecklistTemplate {
  name: string
  description: string
  model_id: string
  frequency: string
  hours_interval?: number
  executor_roles?: ChecklistExecutorRole[]
  sections: ChecklistSection[]
}
