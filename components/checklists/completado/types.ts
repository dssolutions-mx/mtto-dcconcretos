export type CompletedItem = {
  id?: string
  item_id: string
  status: 'pass' | 'flag' | 'fail'
  notes?: string
  photo_url?: string
  description?: string
}

export type ChecklistIssue = {
  id: string
  checklist_id: string
  item_id: string
  status: string
  description: string
  notes: string | null
  photo_url: string | null
  work_order_id: string | null
  resolved: boolean | null
  resolution_date: string | null
  created_at: string | null
}

export type ChecklistItemDefinition = {
  id: string
  description: string
  required?: boolean
  order_index: number
}

export type ChecklistSectionDefinition = {
  id: string
  title: string
  order_index: number
  section_type?: 'checklist' | 'evidence' | 'cleanliness_bonus' | 'security_talk'
  security_config?: {
    mode: 'plant_manager' | 'operator'
    require_attendance: boolean
    require_topic: boolean
    require_reflection: boolean
    allow_evidence: boolean
  }
  checklist_items?: ChecklistItemDefinition[]
}

export type CompletedChecklistData = {
  id: string
  checklist_id: string
  asset_id: string
  completed_items: CompletedItem[]
  technician: string
  completion_date: string
  notes: string | null
  status: string
  signature_data: string | null
  created_by: string | null
  security_data?: Record<string, any> | null
  checklists: {
    id: string
    name: string
    checklist_sections: ChecklistSectionDefinition[]
  }
  assets: {
    id: string
    name: string
    asset_id: string
    location: string
    department: string
  }
  profile: {
    id: string
    nombre: string | null
    apellido: string | null
    role: string | null
    telefono: string | null
    avatar_url: string | null
    departamento: string | null
  } | null
  issues: ChecklistIssue[]
}
