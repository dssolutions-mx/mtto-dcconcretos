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

export interface ChecklistSection {
  id?: string
  title: string
  order_index: number
  section_type?: "checklist" | "evidence" | "cleanliness_bonus" | "security_talk"
  evidence_config?: EvidenceConfig
  cleanliness_config?: CleanlinessConfig
  security_config?: SecurityConfig
  items: ChecklistItem[]
}

export interface ChecklistTemplate {
  name: string
  description: string
  model_id: string
  frequency: string
  hours_interval?: number
  sections: ChecklistSection[]
}
