import { createClient } from '@/lib/supabase-server'

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

export interface CreateWarehouseRequest {
  plant_id: string
  warehouse_code: string
  name: string
  location_notes?: string
  is_primary?: boolean
}

export interface UpdateWarehouseRequest extends Partial<CreateWarehouseRequest> {
  id: string
}

export interface WarehouseListParams {
  plant_id?: string
  is_active?: boolean
  search?: string
}

export class WarehouseService {
  /**
   * Get all warehouses with optional filters
   */
  static async getWarehouses(params: WarehouseListParams = {}): Promise<InventoryWarehouse[]> {
    const supabase = await createClient()
    const { plant_id, is_active, search } = params
    
    try {
      let query = supabase
        .from('inventory_warehouses')
        .select('*')
      
      if (is_active !== undefined) {
        query = query.eq('is_active', is_active)
      }
      
      if (plant_id) {
        query = query.eq('plant_id', plant_id)
      }
      
      if (search) {
        query = query.or(`name.ilike.%${search}%,warehouse_code.ilike.%${search}%`)
      }
      
      const { data, error } = await query
        .order('name', { ascending: true })
      
      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error('Error fetching warehouses:', error)
      throw new Error('Failed to fetch warehouses')
    }
  }
  
  /**
   * Get warehouses for a specific plant
   */
  static async getWarehousesByPlant(plant_id: string): Promise<InventoryWarehouse[]> {
    return this.getWarehouses({ plant_id, is_active: true })
  }
  
  /**
   * Get primary warehouse for a plant
   */
  static async getPrimaryWarehouse(plant_id: string): Promise<InventoryWarehouse | null> {
    const supabase = await createClient()
    
    try {
      const { data, error } = await supabase
        .from('inventory_warehouses')
        .select('*')
        .eq('plant_id', plant_id)
        .eq('is_active', true)
        .eq('is_primary', true)
        .maybeSingle()
      
      if (error) throw error
      
      return data
    } catch (error) {
      console.error('Error fetching primary warehouse:', error)
      throw new Error('Failed to fetch primary warehouse')
    }
  }
  
  /**
   * Get a single warehouse by ID
   */
  static async getWarehouseById(warehouse_id: string): Promise<InventoryWarehouse | null> {
    const supabase = await createClient()
    
    try {
      const { data, error } = await supabase
        .from('inventory_warehouses')
        .select('*')
        .eq('id', warehouse_id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }
      
      return data
    } catch (error) {
      console.error('Error fetching warehouse:', error)
      throw new Error('Failed to fetch warehouse')
    }
  }
  
  /**
   * Create a new warehouse
   */
  static async createWarehouse(request: CreateWarehouseRequest, user_id: string): Promise<InventoryWarehouse> {
    const supabase = await createClient()
    
    try {
      // If this is set as primary, unset other primary warehouses for this plant
      if (request.is_primary) {
        await supabase
          .from('inventory_warehouses')
          .update({ is_primary: false })
          .eq('plant_id', request.plant_id)
          .eq('is_primary', true)
      }
      
      const { data, error } = await supabase
        .from('inventory_warehouses')
        .insert({
          ...request,
          is_primary: request.is_primary || false,
          created_by: user_id,
          updated_by: user_id
        })
        .select()
        .single()
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Warehouse code already exists for this plant')
        }
        throw error
      }
      
      return data
    } catch (error) {
      console.error('Error creating warehouse:', error)
      if (error instanceof Error) throw error
      throw new Error('Failed to create warehouse')
    }
  }
  
  /**
   * Update an existing warehouse
   */
  static async updateWarehouse(request: UpdateWarehouseRequest, user_id: string): Promise<InventoryWarehouse> {
    const supabase = await createClient()
    const { id, ...updates } = request
    
    try {
      // If setting as primary, unset other primary warehouses for this plant
      if (updates.is_primary === true) {
        const warehouse = await this.getWarehouseById(id)
        if (warehouse) {
          await supabase
            .from('inventory_warehouses')
            .update({ is_primary: false })
            .eq('plant_id', warehouse.plant_id)
            .eq('is_primary', true)
            .neq('id', id)
        }
      }
      
      const { data, error } = await supabase
        .from('inventory_warehouses')
        .update({
          ...updates,
          updated_by: user_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Warehouse code already exists for this plant')
        }
        throw error
      }
      
      return data
    } catch (error) {
      console.error('Error updating warehouse:', error)
      if (error instanceof Error) throw error
      throw new Error('Failed to update warehouse')
    }
  }
  
  /**
   * Deactivate a warehouse (soft delete)
   */
  static async deactivateWarehouse(warehouse_id: string, user_id: string): Promise<void> {
    const supabase = await createClient()
    
    try {
      // Check if warehouse has reserved stock
      const { data: stock, error: stockError } = await supabase
        .from('inventory_stock')
        .select('reserved_quantity')
        .eq('warehouse_id', warehouse_id)
        .gt('reserved_quantity', 0)
        .limit(1)
      
      if (stockError) throw stockError
      
      if (stock && stock.length > 0) {
        throw new Error('Cannot deactivate warehouse with reserved stock')
      }
      
      const { error } = await supabase
        .from('inventory_warehouses')
        .update({
          is_active: false,
          updated_by: user_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', warehouse_id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error deactivating warehouse:', error)
      if (error instanceof Error) throw error
      throw new Error('Failed to deactivate warehouse')
    }
  }
  
  /**
   * Reactivate a warehouse
   */
  static async reactivateWarehouse(warehouse_id: string, user_id: string): Promise<void> {
    const supabase = await createClient()
    
    try {
      const { error } = await supabase
        .from('inventory_warehouses')
        .update({
          is_active: true,
          updated_by: user_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', warehouse_id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error reactivating warehouse:', error)
      throw new Error('Failed to reactivate warehouse')
    }
  }
}
