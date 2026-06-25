export type SchedulePlant = {
  id: string
  name: string
}

export type ScheduleAsset = {
  id: string
  name: string
  asset_id: string
  location: string | null
  model_id: string | null
  plant_id: string | null
  plants: { id?: string; name: string } | null
  equipment_models: { name: string; maintenance_unit?: string | null } | null
}

export type ScheduleTemplateSection = {
  section_type: string | null
  title: string
}

export type ScheduleTemplate = {
  id: string
  name: string
  frequency: string
  model_id: string | null
  executor_roles: string[] | null
  equipment_models: { name: string; maintenance_unit?: string | null } | null
  checklist_sections?: ScheduleTemplateSection[]
}

export type ScheduleUser = {
  id: string
  nombre: string | null
  apellido: string | null
  role: string | null
  plant_id: string | null
}

export type PendingSchedule = {
  id: string
  template_id: string
  asset_id: string
  scheduled_date: string
  scheduled_day?: string | null
  status: string
  assigned_to: string | null
  checklists?: { id: string; name: string; frequency: string } | null
  profiles?: { id: string; nombre: string | null; apellido: string | null } | null
}

export type MaintenanceInterval = {
  id: string
  name: string
  interval_value: number
  type?: string | null
}

export type MaintenancePlan = {
  id: string
  name: string
  next_due: string | null
  maintenance_intervals?: { name: string; type?: string | null } | null
}
