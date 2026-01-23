// Inventory System TypeScript Types

export type PartCategory = 'Repuesto' | 'Consumible' | 'Herramienta' | 'Otro'

export type MovementType = 
  | 'receipt' 
  | 'issue' 
  | 'adjustment' 
  | 'transfer_out' 
  | 'transfer_in' 
  | 'return' 
  | 'reservation' 
  | 'unreserve'
  | 'return_to_supplier'

export type ReferenceType = 
  | 'purchase_order' 
  | 'work_order' 
  | 'manual' 
  | 'transfer'
  | 'work_order_edit'
  | 'work_order_cancel'
  | 'work_order_delete'
  | 'supplier_return'

export type SupplierReturnStatus = 'pending' | 'shipped' | 'credited' | 'replaced' | 'rejected'

export type FulfillmentSource = 'purchase' | 'inventory' | 'mixed'

export type StockStatus = 'ok' | 'low' | 'critical' | 'out_of_stock'

export interface InventoryPart {
  id: string
  part_number: string
  part_number_normalized?: string
  name: string
  description?: string
  category: PartCategory
  unit_of_measure: string
  manufacturer?: string
  supplier_id?: string
  warranty_period_months?: number
  specifications?: Record<string, any>
  default_unit_cost?: number
  is_active: boolean
  created_by?: string
  updated_by?: string
  created_at?: string
  updated_at?: string
}

export interface SupplierPartNumber {
  id: string
  part_id: string
  supplier_id: string
  supplier_part_number: string
  supplier_part_name?: string
  is_primary: boolean
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface InventoryWarehouse {
  id: string
  plant_id: string
  warehouse_code: string
  name: string
  location_notes?: string
  is_primary: boolean
  is_active: boolean
  created_by?: string
  updated_by?: string
  created_at?: string
  updated_at?: string
}

export interface InventoryStock {
  id: string
  part_id: string
  warehouse_id: string
  current_quantity: number
  reserved_quantity: number
  min_stock_level: number
  max_stock_level?: number
  reorder_point?: number
  average_unit_cost: number
  total_value: number
  last_movement_date?: string
  last_counted_date?: string
  oldest_reservation_date?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface InventoryStockWithDetails extends InventoryStock {
  part?: {
    id: string
    part_number: string
    name: string
    category: string
    unit_of_measure: string
  }
  warehouse?: {
    id: string
    name: string
    warehouse_code: string
    plant_id: string
  }
}

export interface InventoryMovement {
  id: string
  part_id: string
  stock_id: string
  warehouse_id: string
  movement_type: MovementType
  quantity: number
  unit_cost?: number
  total_cost?: number
  reference_type?: ReferenceType
  reference_id?: string
  transfer_to_warehouse_id?: string
  work_order_id?: string
  purchase_order_id?: string
  supplier_return_reason?: string
  supplier_return_status?: SupplierReturnStatus
  notes?: string
  performed_by: string
  movement_date: string
  created_at?: string
  ip_address?: string
  user_agent?: string
}

export interface InventoryMovementWithDetails extends InventoryMovement {
  part?: {
    id: string
    part_number: string
    name: string
  }
  warehouse?: {
    id: string
    name: string
    warehouse_code: string
  }
  performed_by_user?: {
    id: string
    nombre?: string
    apellido?: string
  }
}

export interface AvailabilityByWarehouse {
  warehouse_id: string
  warehouse_name: string
  warehouse_code: string
  current_quantity: number
  reserved_quantity: number
  available_quantity: number
  sufficient: boolean
}

export interface PartAvailability {
  part_id: string
  part_number: string
  part_name: string
  required_quantity: number
  available_by_warehouse: AvailabilityByWarehouse[]
  total_available: number
  sufficient: boolean
}

export interface PurchaseOrderReceipt {
  id: string
  purchase_order_id: string
  receipt_number: string
  receipt_date: string
  warehouse_id: string
  items: Array<{
    po_item_index: number
    part_id?: string
    quantity: number
    unit_cost: number
  }>
  total_items: number
  total_value: number
  notes?: string
  received_by: string
  created_at?: string
}

export interface RequiredPart {
  part_id?: string
  part_number?: string
  name: string
  quantity: number
  estimated_unit_cost?: number
}

export interface Reservation {
  movement_id: string
  part_id: string
  part_number: string
  part_name: string
  warehouse_id: string
  warehouse_name: string
  reserved_quantity: number
  reserved_date: string
  days_reserved: number
}

export interface ReservationChange {
  action: 'unreserve' | 'reserve'
  part_id: string
  warehouse_id: string
  quantity: number
  original_movement_id?: string
}

export interface AdhocPart {
  part_id: string
  part_number: string
  part_name: string
  warehouse_id: string
  warehouse_name: string
  quantity: number
  unit_cost: number
  notes?: string
  is_adhoc: true
}

export interface ManualPart {
  name: string
  description?: string
  quantity: number
  unit_cost: number
  source?: string
  is_from_inventory: false
}

export interface LowStockAlert {
  stock_id: string
  part_id: string
  part_number: string
  part_name: string
  category: string
  warehouse_id: string
  warehouse_name: string
  warehouse_code: string
  plant_id: string
  plant_name: string
  current_quantity: number
  reserved_quantity: number
  available_quantity: number
  reorder_point?: number
  min_stock_level: number
  average_unit_cost: number
  stock_status: StockStatus
}

export interface StaleReservation {
  work_order_id: string
  work_order_number: string
  work_order_status: string
  work_order_description?: string
  movement_id: string
  reserved_quantity: number
  reserved_since: string
  days_reserved: number
  part_number: string
  part_name: string
  warehouse_name: string
  plant_name: string
  requested_by?: string
}

export interface InventoryValuation {
  warehouse_id: string
  warehouse_name: string
  plant_name: string
  total_parts: number
  total_units: number
  total_value: number
  total_reserved_units: number
  reserved_value: number
}
