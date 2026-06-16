export type TireCondition = 'nueva' | 'renovada'
export type TireStatus = 'en_almacen' | 'montada' | 'baja'
export type TireEventType =
  | 'montaje'
  | 'desmontaje'
  | 'rotacion'
  | 'reparacion'
  | 'renovado'
  | 'baja'

export interface Tire {
  id: string
  serial_number: string | null
  brand: string
  model: string | null
  size: string
  condition: TireCondition
  purchase_cost: number | null
  purchase_date: string | null
  status: TireStatus
  min_tread_mm: number
  notes: string | null
  purchase_order_id: string | null
  supplier_id: string | null
  po_line_index: number | null
  inventory_part_id: string | null
  warehouse_id: string | null
  plant_id: string | null
  created_at: string
  updated_at: string
}

export interface AssetTireInstallation {
  id: string
  tire_id: string
  asset_id: string
  position_code: string
  position_label: string
  axle_number: number | null
  installed_at: string
  removed_at: string | null
  km_at_install: number | null
  hours_at_install: number | null
  km_at_remove: number | null
  hours_at_remove: number | null
  installed_by: string | null
  work_order_id: string | null
  notes: string | null
  created_at: string
  tire?: Tire
  latest_reading?: TireReading | null
}

export interface TireReading {
  id: string
  installation_id: string
  tire_id: string
  asset_id: string
  read_at: string
  tread_depth_mm: number | null
  pressure_psi: number | null
  odometer_km: number | null
  horometer_hours: number | null
  recorded_by: string | null
  checklist_id: string | null
  position_code: string | null
  notes: string | null
  created_at: string
}

export interface TireEvent {
  id: string
  tire_id: string
  installation_id: string | null
  asset_id: string | null
  event_type: TireEventType
  event_at: string
  cost: number | null
  from_position: string | null
  to_position: string | null
  odometer_km: number | null
  horometer_hours: number | null
  notes: string | null
  work_order_id: string | null
  created_by: string | null
  created_at: string
}

export interface TirePosition {
  code: string
  label: string
  axle: number
  side: 'izq' | 'der' | 'centro'
}

export interface CreateTireInput {
  serial_number?: string
  brand: string
  model?: string
  size: string
  condition?: TireCondition
  purchase_cost?: number
  purchase_date?: string
  min_tread_mm?: number
  notes?: string
}

export interface MountTireInput {
  tire_id: string
  position_code: string
  position_label: string
  axle_number?: number
  notes?: string
  work_order_id?: string
}

export interface TireReadingInput {
  installation_id: string
  tread_depth_mm?: number
  pressure_psi?: number
  notes?: string
}

export interface TireCostReportRow {
  tire_id: string
  brand: string
  size: string
  serial_number: string | null
  total_cost: number
  km_traveled: number | null
  cost_per_km: number | null
  current_tread_mm: number | null
  status: TireStatus
  asset_name: string | null
}
