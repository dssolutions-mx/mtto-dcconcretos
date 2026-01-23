import { createClient } from '@/lib/supabase-server'

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

export interface StockWithDetails extends InventoryStock {
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

export interface FlattenedStockItem {
  id: string
  part_id: string
  warehouse_id: string
  part_number: string
  part_name: string
  category: string
  unit_of_measure: string
  warehouse_name: string
  warehouse_code: string
  plant_id: string
  current_quantity: number
  reserved_quantity: number
  available_quantity: number
  min_stock_level: number
  max_stock_level?: number
  reorder_point?: number
  average_unit_cost: number
  total_value: number
  last_movement_date?: string
  last_counted_date?: string
  oldest_reservation_date?: string
  notes?: string
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

export interface StockListParams {
  warehouse_id?: string
  plant_id?: string
  part_id?: string
  low_stock_only?: boolean
  search?: string
}

export interface AdjustStockRequest {
  stock_id: string
  physical_count: number
  adjustment_reason: 'physical_count' | 'damage_loss' | 'found_stock' | 'measurement_error' | 'other'
  adjustment_date: string
  notes?: string
}

export class StockService {
  /**
   * Get stock levels with optional filters
   */
  static async getStock(params: StockListParams = {}): Promise<FlattenedStockItem[]> {
    const supabase = await createClient()
    const { warehouse_id, plant_id, part_id, low_stock_only, search } = params
    
    try {
      let query = supabase
        .from('inventory_stock')
        .select(`
          *,
          part:inventory_parts(id, part_number, name, category, unit_of_measure),
          warehouse:inventory_warehouses(id, name, warehouse_code, plant_id)
        `)
      
      if (warehouse_id) {
        query = query.eq('warehouse_id', warehouse_id)
      }
      
      if (plant_id) {
        query = query.eq('warehouse.plant_id', plant_id)
      }
      
      if (part_id) {
        query = query.eq('part_id', part_id)
      }
      
      // Note: low_stock_only filtering is better done in the view or after fetching
      // PostgreSQL doesn't support computed columns in WHERE clauses easily
      
      if (search) {
        query = query.or(`part.part_number.ilike.%${search}%,part.name.ilike.%${search}%`)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      // Transform and flatten the data
      const stockData = (data || []).map((item: any) => ({
        id: item.id,
        part_id: item.part_id,
        warehouse_id: item.warehouse_id,
        part_number: item.part?.part_number || '',
        part_name: item.part?.name || '',
        category: item.part?.category || '',
        unit_of_measure: item.part?.unit_of_measure || 'pcs',
        warehouse_name: item.warehouse?.name || '',
        warehouse_code: item.warehouse?.warehouse_code || '',
        plant_id: item.warehouse?.plant_id || '',
        current_quantity: parseFloat(item.current_quantity) || 0,
        reserved_quantity: parseFloat(item.reserved_quantity) || 0,
        available_quantity: (parseFloat(item.current_quantity) || 0) - (parseFloat(item.reserved_quantity) || 0),
        min_stock_level: parseFloat(item.min_stock_level) || 0,
        max_stock_level: item.max_stock_level ? parseFloat(item.max_stock_level) : undefined,
        reorder_point: item.reorder_point ? parseFloat(item.reorder_point) : undefined,
        average_unit_cost: parseFloat(item.average_unit_cost) || 0,
        total_value: parseFloat(item.total_value) || 0,
        last_movement_date: item.last_movement_date,
        last_counted_date: item.last_counted_date,
        oldest_reservation_date: item.oldest_reservation_date,
        notes: item.notes
      }))
      
      // Sort by part name
      return stockData.sort((a, b) => a.part_name.localeCompare(b.part_name, 'es'))
    } catch (error) {
      console.error('Error fetching stock:', error)
      throw new Error('Failed to fetch stock')
    }
  }
  
  /**
   * Get stock for a specific part across all warehouses
   */
  static async getStockByPart(part_id: string, plant_id?: string): Promise<StockWithDetails[]> {
    return this.getStock({ part_id, plant_id })
  }
  
  /**
   * Get stock for a specific warehouse
   */
  static async getStockByWarehouse(warehouse_id: string): Promise<StockWithDetails[]> {
    return this.getStock({ warehouse_id })
  }
  
  /**
   * Check availability for a part across plant's warehouses
   */
  static async checkAvailability(
    part_id: string,
    plant_id: string,
    required_quantity: number
  ): Promise<AvailabilityByWarehouse[]> {
    const supabase = await createClient()
    
    try {
      const { data, error } = await supabase
        .rpc('check_inventory_availability', {
          p_part_id: part_id,
          p_plant_id: plant_id,
          p_quantity: required_quantity
        })
      
      if (error) {
        // If function doesn't exist yet, fall back to manual query
        const stock = await this.getStock({ part_id, plant_id })
        return stock.map(s => ({
          warehouse_id: s.warehouse_id,
          warehouse_name: s.warehouse?.name || '',
          warehouse_code: s.warehouse?.warehouse_code || '',
          current_quantity: s.current_quantity,
          reserved_quantity: s.reserved_quantity,
          available_quantity: s.current_quantity - s.reserved_quantity,
          sufficient: (s.current_quantity - s.reserved_quantity) >= required_quantity
        }))
      }
      
      return data || []
    } catch (error) {
      console.error('Error checking availability:', error)
      // Fallback to manual query
      const stock = await this.getStock({ part_id, plant_id })
      return stock.map(s => ({
        warehouse_id: s.warehouse_id,
        warehouse_name: s.warehouse?.name || '',
        warehouse_code: s.warehouse?.warehouse_code || '',
        current_quantity: s.current_quantity,
        reserved_quantity: s.reserved_quantity,
        available_quantity: s.current_quantity - s.reserved_quantity,
        sufficient: (s.current_quantity - s.reserved_quantity) >= required_quantity
      }))
    }
  }
  
  /**
   * Check availability for multiple parts
   */
  static async checkMultiplePartsAvailability(
    parts: Array<{ part_id: string; quantity: number }>,
    plant_id: string
  ): Promise<PartAvailability[]> {
    const results: PartAvailability[] = []
    
    for (const part of parts) {
      const availability = await this.checkAvailability(part.part_id, plant_id, part.quantity)
      
      // Get part details
      const { data: partData } = await (await createClient())
        .from('inventory_parts')
        .select('part_number, name')
        .eq('id', part.part_id)
        .single()
      
      const total_available = availability.reduce((sum, a) => sum + a.available_quantity, 0)
      
      results.push({
        part_id: part.part_id,
        part_number: partData?.part_number || '',
        part_name: partData?.name || '',
        required_quantity: part.quantity,
        available_by_warehouse: availability,
        total_available,
        sufficient: total_available >= part.quantity
      })
    }
    
    return results
  }
  
  /**
   * Get or create stock entry for a part in a warehouse
   */
  static async getOrCreateStock(
    part_id: string,
    warehouse_id: string
  ): Promise<InventoryStock> {
    const supabase = await createClient()
    
    try {
      // Try to get existing stock
      const { data: existing, error: getError } = await supabase
        .from('inventory_stock')
        .select('*')
        .eq('part_id', part_id)
        .eq('warehouse_id', warehouse_id)
        .maybeSingle()
      
      if (getError && getError.code !== 'PGRST116') throw getError
      
      if (existing) {
        return existing
      }
      
      // Create new stock entry
      const { data: newStock, error: createError } = await supabase
        .from('inventory_stock')
        .insert({
          part_id,
          warehouse_id,
          current_quantity: 0,
          reserved_quantity: 0,
          min_stock_level: 0,
          average_unit_cost: 0
        })
        .select()
        .single()
      
      if (createError) throw createError
      
      return newStock
    } catch (error) {
      console.error('Error getting or creating stock:', error)
      throw new Error('Failed to get or create stock')
    }
  }
  
  /**
   * Adjust stock (manual adjustment)
   */
  static async adjustStock(request: AdjustStockRequest, user_id: string): Promise<InventoryStock> {
    const supabase = await createClient()
    
    try {
      // Get current stock
      const { data: stock, error: stockError } = await supabase
        .from('inventory_stock')
        .select('*')
        .eq('id', request.stock_id)
        .single()
      
      if (stockError) throw stockError
      
      const adjustment_quantity = request.physical_count - stock.current_quantity
      
      // Create adjustment movement
      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          part_id: stock.part_id,
          stock_id: request.stock_id,
          warehouse_id: stock.warehouse_id,
          movement_type: 'adjustment',
          quantity: adjustment_quantity,
          reference_type: 'manual',
          performed_by: user_id,
          movement_date: request.adjustment_date,
          notes: `Physical count: ${request.physical_count}. Reason: ${request.adjustment_reason}. ${request.notes || ''}`
        })
      
      if (movementError) throw movementError
      
      // Get updated stock (trigger updates it)
      const { data: updatedStock, error: updatedError } = await supabase
        .from('inventory_stock')
        .select('*')
        .eq('id', request.stock_id)
        .single()
      
      if (updatedError) throw updatedError
      
      return updatedStock
    } catch (error) {
      console.error('Error adjusting stock:', error)
      throw new Error('Failed to adjust stock')
    }
  }
  
  /**
   * Update reorder point and min/max levels
   */
  static async updateStockLevels(
    stock_id: string,
    min_stock_level?: number,
    max_stock_level?: number,
    reorder_point?: number
  ): Promise<InventoryStock> {
    const supabase = await createClient()
    
    try {
      const updates: any = {}
      if (min_stock_level !== undefined) updates.min_stock_level = min_stock_level
      if (max_stock_level !== undefined) updates.max_stock_level = max_stock_level
      if (reorder_point !== undefined) updates.reorder_point = reorder_point
      
      const { data, error } = await supabase
        .from('inventory_stock')
        .update(updates)
        .eq('id', stock_id)
        .select()
        .single()
      
      if (error) throw error
      
      return data
    } catch (error) {
      console.error('Error updating stock levels:', error)
      throw new Error('Failed to update stock levels')
    }
  }
}
