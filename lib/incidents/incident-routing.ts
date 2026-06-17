export const INCIDENT_PIPELINE_STAGES = [
  "bandeja",
  "asignado",
  "en_atencion",
  "esperando",
  "cerrado",
] as const

export type IncidentPipelineStage = (typeof INCIDENT_PIPELINE_STAGES)[number]

export const PIPELINE_STAGE_LABELS: Record<IncidentPipelineStage, string> = {
  bandeja: "Bandeja",
  asignado: "Asignado",
  en_atencion: "En atención",
  esperando: "Esperando",
  cerrado: "Cerrado",
}

export const PIPELINE_STAGE_COLORS: Record<IncidentPipelineStage, string> = {
  bandeja: "bg-slate-100 border-slate-300",
  asignado: "bg-blue-50 border-blue-300",
  en_atencion: "bg-amber-50 border-amber-300",
  esperando: "bg-orange-50 border-orange-300",
  cerrado: "bg-green-50 border-green-300",
}

export type IncidentRoutingRule = {
  id: string
  name: string
  description: string | null
  priority: number
  is_active: boolean
  plant_id: string | null
  match_incident_type: string | null
  match_impact: string | null
  match_description_contains: string | null
  target_department_id: string
  default_assignee_id: string | null
  target_response_hours: number
  source?: "manual" | "learned"
  pattern_key?: string | null
  sample_count?: number
  confidence?: number
  created_at: string
  updated_at: string
  departments?: { id: string; name: string; code: string } | null
  plants?: { id: string; name: string; code: string } | null
}

export type RoutedIncident = {
  id: string
  description: string
  type: string
  status: string | null
  impact: string | null
  date: string
  created_at: string | null
  asset_id: string | null
  routing_department_id: string | null
  assigned_to_id: string | null
  pipeline_stage: IncidentPipelineStage
  target_response_hours: number | null
  routed_at: string | null
  assigned_at: string | null
  acknowledged_at?: string | null
  asset_display_name?: string
  asset_code?: string
  department_name?: string
  assignee_name?: string
  hours_since_routed?: number
  sla_breached?: boolean
}

export type IncidentAssignmentLogEntry = {
  id: string
  incident_id: string
  from_department_id: string | null
  to_department_id: string | null
  from_assignee_id: string | null
  to_assignee_id: string | null
  from_pipeline_stage: string | null
  to_pipeline_stage: string | null
  reason: string | null
  created_at: string
}

export function isOpenIncidentStatus(status: string | null | undefined): boolean {
  if (!status) return true
  const normalized = status.toLowerCase()
  return !["resuelto", "cerrado", "resolved", "closed"].includes(normalized)
}

export function hoursSince(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null
  const ms = Date.now() - new Date(timestamp).getTime()
  return Math.max(0, Math.round(ms / (1000 * 60 * 60)))
}

export function isSlaBreached(
  routedAt: string | null | undefined,
  targetHours: number | null | undefined,
  status: string | null | undefined,
): boolean {
  if (!isOpenIncidentStatus(status)) return false
  if (!routedAt || !targetHours) return false
  const elapsed = hoursSince(routedAt)
  return elapsed !== null && elapsed > targetHours
}

export function groupIncidentsByPipelineStage<T extends { pipeline_stage?: string | null }>(
  incidents: T[],
): Record<IncidentPipelineStage, T[]> {
  const groups = Object.fromEntries(
    INCIDENT_PIPELINE_STAGES.map((stage) => [stage, [] as T[]]),
  ) as Record<IncidentPipelineStage, T[]>

  for (const incident of incidents) {
    const stage = (incident.pipeline_stage ?? "bandeja") as IncidentPipelineStage
    if (groups[stage]) {
      groups[stage].push(incident)
    } else {
      groups.bandeja.push(incident)
    }
  }

  return groups
}

export type RoutingRuleInput = {
  name: string
  description?: string | null
  priority?: number
  is_active?: boolean
  plant_id?: string | null
  match_incident_type?: string | null
  match_impact?: string | null
  match_description_contains?: string | null
  target_department_id: string
  default_assignee_id?: string | null
  target_response_hours?: number
}

export type IncidentAssignmentInput = {
  routing_department_id?: string | null
  assigned_to_id?: string | null
  pipeline_stage?: IncidentPipelineStage
  reason?: string
}
