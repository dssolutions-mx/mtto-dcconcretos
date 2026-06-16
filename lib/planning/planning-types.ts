/**
 * Planning domain types — service windows, availability, ops notifications.
 */

export type ServiceWindowStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
export type ServiceWindowReason = 'corrective' | 'preventive' | 'inspection' | 'other'

export interface AssetServiceWindow {
  id: string
  asset_id: string
  work_order_id: string | null
  plant_id: string | null
  starts_at: string
  ends_at: string
  planning_status: ServiceWindowStatus
  reason: ServiceWindowReason | null
  notes: string | null
  ops_notified_at: string | null
  ops_acknowledged_at: string | null
  asset_code?: string | null
  asset_name?: string | null
  asset_status?: string | null
  work_order_label?: string | null
}

export interface ProductionCommitment {
  type: 'remision' | 'order'
  date: string
  time: string | null
  label: string
  volume_m3: number | null
  unit_code: string
}

export interface AvailabilityCheck {
  asset_id: string
  asset_code: string | null
  asset_status: string | null
  window_start: string
  window_end: string
  production_conflicts: ProductionCommitment[]
  overlapping_windows: Array<{ id: string; starts_at: string; ends_at: string; status: string }>
  suggested_slots: Array<{ starts_at: string; ends_at: string; label: string }>
  can_schedule: boolean
  warnings: string[]
}

export interface PlanningCalendarEvent {
  event_id: string
  event_type: 'service_window' | 'work_order'
  asset_id: string
  work_order_id: string | null
  plant_id: string | null
  starts_at: string
  ends_at: string
  status: string
  reason: string | null
  ops_notified_at: string | null
  asset_code: string | null
  asset_name: string | null
  asset_status: string | null
  work_order_label: string | null
  technician_id: string | null
}

export const PLANNING_STATUS_LABELS: Record<ServiceWindowStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmada',
  in_progress: 'En servicio',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

export const ASSET_STATUS_LABELS: Record<string, string> = {
  operational: 'Operativo',
  maintenance: 'Mantenimiento',
  repair: 'Reparación',
  inactive: 'Inactivo',
  retired: 'Retirado',
}
