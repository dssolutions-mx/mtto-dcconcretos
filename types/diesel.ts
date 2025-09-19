export type DieselResolution = {
  resolution_type: 'formal' | 'exception' | 'general'
  asset_id: string | null
  exception_asset_id: string | null
  asset_category: 'formal' | 'exception' | 'general'
}

export type DieselTransaction = {
  id?: string
  plant_id: string | null
  warehouse_id: string
  asset_id: string | null
  exception_asset_name: string | null
  asset_category: 'formal' | 'exception' | 'general'
  product_id: string
  transaction_type: 'entry' | 'consumption' | 'adjustment'
  quantity_liters: number
  horometer_reading?: number | null
  kilometer_reading?: number | null
  operator_id?: string | null
  transaction_date: string
  created_by: string
}

export type DieselWarehouseBalance = {
  warehouse_id: string
  balance_liters: number
}


