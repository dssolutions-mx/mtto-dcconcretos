import { createClient } from '@/lib/supabase-server'

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
  supplier_return_status?: 'pending' | 'shipped' | 'credited' | 'replaced' | 'rejected'
  notes?: string
  performed_by: string
  movement_date: string
  created_at?: string
  ip_address?: string
  user_agent?: string
}

export interface MovementWithDetails extends InventoryMovement {
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

export interface MovementListParams {
  part_id?: string
  warehouse_id?: string
  movement_type?: MovementType
  work_order_id?: string
  purchase_order_id?: string
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
}

export interface MovementsResponse {
  movements: MovementWithDetails[]
  total: number
  page: number
  limit: number
}

export class MovementService {
  /**
   * Get movement history with optional filters
   */
  static async getMovements(params: MovementListParams = {}): Promise<MovementsResponse> {
    const supabase = await createClient()
    const { 
      part_id, 
      warehouse_id, 
      movement_type, 
      work_order_id, 
      purchase_order_id,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = params
    
    try {
      let query = supabase
        .from('inventory_movements')
        .select(`
          *,
          part:inventory_parts(id, part_number, name),
          warehouse:inventory_warehouses(id, name, warehouse_code)
        `, { count: 'exact' })
      
      if (part_id) {
        query = query.eq('part_id', part_id)
      }
      
      if (warehouse_id) {
        query = query.eq('warehouse_id', warehouse_id)
      }
      
      if (movement_type) {
        query = query.eq('movement_type', movement_type)
      }
      
      if (work_order_id) {
        query = query.eq('work_order_id', work_order_id)
      }
      
      if (purchase_order_id) {
        query = query.eq('purchase_order_id', purchase_order_id)
      }
      
      if (start_date) {
        query = query.gte('movement_date', start_date)
      }
      
      if (end_date) {
        query = query.lte('movement_date', end_date)
      }
      
      const from = (page - 1) * limit
      const to = from + limit - 1
      
      const { data, error, count } = await query
        .order('movement_date', { ascending: false })
        .range(from, to)
      
      if (error) throw error
      
      // Fetch user profiles separately if needed
      const movements = (data || []) as any[]
      const userIds = [...new Set(movements.map(m => m.performed_by).filter(Boolean))]
      
      let profilesMap = new Map()
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nombre, apellido')
          .in('id', userIds)
        
        if (profiles) {
          profilesMap = new Map(profiles.map(p => [p.id, p]))
        }
      }
      
      // Enrich movements with profile data
      const enrichedMovements = movements.map(movement => ({
        ...movement,
        performed_by_user: movement.performed_by ? profilesMap.get(movement.performed_by) : null
      }))
      
      return {
        movements: enrichedMovements as MovementWithDetails[],
        total: count || 0,
        page,
        limit
      }
    } catch (error) {
      console.error('Error fetching movements:', error)
      throw new Error('Failed to fetch movements')
    }
  }
  
  /**
   * Get movements for a specific work order
   */
  static async getWorkOrderMovements(work_order_id: string): Promise<MovementWithDetails[]> {
    const result = await this.getMovements({ work_order_id, limit: 1000 })
    return result.movements
  }
  
  /**
   * Get movements for a specific purchase order
   */
  static async getPurchaseOrderMovements(purchase_order_id: string): Promise<MovementWithDetails[]> {
    const result = await this.getMovements({ purchase_order_id, limit: 1000 })
    return result.movements
  }
  
  /**
   * Create a movement (used by other services, not directly)
   */
  static async createMovement(
    movement: Omit<InventoryMovement, 'id' | 'created_at'>,
    ip_address?: string,
    user_agent?: string
  ): Promise<InventoryMovement> {
    const supabase = await createClient()
    
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .insert({
          ...movement,
          total_cost: movement.unit_cost && movement.quantity 
            ? Math.abs(movement.quantity) * movement.unit_cost 
            : undefined,
          ip_address,
          user_agent
        })
        .select()
        .single()
      
      if (error) throw error
      
      return data
    } catch (error) {
      console.error('Error creating movement:', error)
      throw new Error('Failed to create movement')
    }
  }
  
  /**
   * Get reservations for a work order
   */
  static async getReservations(work_order_id: string): Promise<MovementWithDetails[]> {
    const movements = await this.getWorkOrderMovements(work_order_id)
    return movements.filter(m => m.movement_type === 'reservation')
  }
  
  /**
   * Get low stock alerts
   */
  static async getLowStockAlerts(plant_id?: string): Promise<any[]> {
    const supabase = await createClient()
    
    try {
      let query = supabase
        .from('inventory_low_stock_alerts')
        .select('*')
      
      if (plant_id) {
        query = query.eq('plant_id', plant_id)
      }
      
      const { data, error } = await query
        .order('stock_status', { ascending: true })
        .order('part_name', { ascending: true })
      
      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error('Error fetching low stock alerts:', error)
      throw new Error('Failed to fetch low stock alerts')
    }
  }
  
  /**
   * Get stale reservations (> 30 days)
   */
  static async getStaleReservations(plant_id?: string): Promise<any[]> {
    const supabase = await createClient()
    
    try {
      let query = supabase
        .from('inventory_stale_reservations')
        .select('*')
      
      if (plant_id) {
        query = query.eq('plant_id', plant_id)
      }
      
      const { data, error } = await query
        .order('reserved_since', { ascending: true })
      
      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error('Error fetching stale reservations:', error)
      throw new Error('Failed to fetch stale reservations')
    }
  }
  
  /**
   * Get inventory valuation by warehouse
   */
  static async getInventoryValuation(plant_id?: string): Promise<any[]> {
    const supabase = await createClient()
    
    try {
      let query = supabase
        .from('inventory_valuation')
        .select('*')
      
      if (plant_id) {
        query = query.eq('plant_id', plant_id)
      }
      
      const { data, error } = await query
        .order('plant_name', { ascending: true })
        .order('warehouse_name', { ascending: true })
      
      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error('Error fetching inventory valuation:', error)
      throw new Error('Failed to fetch inventory valuation')
    }
  }
}
