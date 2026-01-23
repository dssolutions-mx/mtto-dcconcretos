import { createClient } from '@/lib/supabase-server'
import { MovementService } from './movement-service'
import { StockService } from './stock-service'

export interface ReservationRequest {
  part_id: string
  warehouse_id: string
  quantity: number
  notes?: string
}

export interface ReservePartsRequest {
  work_order_id: string
  reservations: ReservationRequest[]
  reservation_date?: string
}

export interface ReservationResult {
  movement_id: string
  part_id: string
  warehouse_id: string
  quantity: number
  success: boolean
  error_message?: string
}

export interface UnreserveRequest {
  work_order_id: string
  movement_ids?: string[] // If not provided, unreserves all
  notes?: string
}

export class InventoryReservationService {
  /**
   * Reserve parts for a work order
   */
  static async reserveParts(
    request: ReservePartsRequest,
    user_id: string
  ): Promise<ReservationResult[]> {
    const supabase = await createClient()
    const results: ReservationResult[] = []
    
    try {
      // Process each reservation in a transaction-like manner
      for (const reservation of request.reservations) {
        try {
          // Get or create stock entry
          const stock = await StockService.getOrCreateStock(
            reservation.part_id,
            reservation.warehouse_id
          )
          
          // Verify availability
          const available = stock.current_quantity - stock.reserved_quantity
          if (available < reservation.quantity) {
            results.push({
              movement_id: '',
              part_id: reservation.part_id,
              warehouse_id: reservation.warehouse_id,
              quantity: reservation.quantity,
              success: false,
              error_message: `Insufficient stock. Available: ${available}, Requested: ${reservation.quantity}`
            })
            continue
          }
          
          // Create reservation movement
          const movement = await MovementService.createMovement({
            part_id: reservation.part_id,
            stock_id: stock.id,
            warehouse_id: reservation.warehouse_id,
            movement_type: 'reservation',
            quantity: reservation.quantity,
            work_order_id: request.work_order_id,
            reference_type: 'work_order',
            performed_by: user_id,
            movement_date: request.reservation_date || new Date().toISOString(),
            notes: reservation.notes
          })
          
          // Update work order reservation flag
          await supabase
            .from('work_orders')
            .update({
              inventory_reserved: true,
              inventory_reservation_date: request.reservation_date || new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', request.work_order_id)
          
          results.push({
            movement_id: movement.id,
            part_id: reservation.part_id,
            warehouse_id: reservation.warehouse_id,
            quantity: reservation.quantity,
            success: true
          })
        } catch (error) {
          console.error(`Error reserving part ${reservation.part_id}:`, error)
          results.push({
            movement_id: '',
            part_id: reservation.part_id,
            warehouse_id: reservation.warehouse_id,
            quantity: reservation.quantity,
            success: false,
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      return results
    } catch (error) {
      console.error('Error reserving parts:', error)
      throw new Error('Failed to reserve parts')
    }
  }
  
  /**
   * Unreserve parts for a work order
   */
  static async unreserveParts(
    request: UnreserveRequest,
    user_id: string
  ): Promise<ReservationResult[]> {
    const supabase = await createClient()
    const results: ReservationResult[] = []
    
    try {
      // Get reservations to unreserve
      let reservations
      if (request.movement_ids && request.movement_ids.length > 0) {
        const { data, error } = await supabase
          .from('inventory_movements')
          .select('*')
          .eq('work_order_id', request.work_order_id)
          .eq('movement_type', 'reservation')
          .in('id', request.movement_ids)
        
        if (error) throw error
        reservations = data || []
      } else {
        reservations = await MovementService.getReservations(request.work_order_id)
      }
      
      // Process each unreserve
      for (const reservation of reservations) {
        try {
          // Get stock
          const { data: stock, error: stockError } = await supabase
            .from('inventory_stock')
            .select('*')
            .eq('id', reservation.stock_id)
            .single()
          
          if (stockError) throw stockError
          
          // Create unreserve movement
          const movement = await MovementService.createMovement({
            part_id: reservation.part_id,
            stock_id: reservation.stock_id,
            warehouse_id: reservation.warehouse_id,
            movement_type: 'unreserve',
            quantity: -reservation.quantity, // Negative to reverse
            work_order_id: request.work_order_id,
            reference_type: 'work_order',
            performed_by: user_id,
            movement_date: new Date().toISOString(),
            notes: request.notes || 'Manual unreserve'
          })
          
          results.push({
            movement_id: movement.id,
            part_id: reservation.part_id,
            warehouse_id: reservation.warehouse_id,
            quantity: reservation.quantity,
            success: true
          })
        } catch (error) {
          console.error(`Error unreserving part ${reservation.part_id}:`, error)
          results.push({
            movement_id: '',
            part_id: reservation.part_id,
            warehouse_id: reservation.warehouse_id,
            quantity: reservation.quantity,
            success: false,
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      // Check if all reservations are unreserved
      const remainingReservations = await MovementService.getReservations(request.work_order_id)
      if (remainingReservations.length === 0) {
        await supabase
          .from('work_orders')
          .update({
            inventory_reserved: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', request.work_order_id)
      }
      
      return results
    } catch (error) {
      console.error('Error unreserving parts:', error)
      throw new Error('Failed to unreserve parts')
    }
  }
  
  /**
   * Get reservation status for a work order
   */
  static async getReservationStatus(work_order_id: string): Promise<{
    work_order_id: string
    inventory_reserved: boolean
    reservations: Array<{
      movement_id: string
      part_id: string
      part_number: string
      part_name: string
      warehouse_id: string
      warehouse_name: string
      reserved_quantity: number
      reserved_date: string
      days_reserved: number
    }>
    summary: {
      total_parts_reserved: number
      total_units_reserved: number
      oldest_reservation_days: number
    }
  }> {
    const supabase = await createClient()
    
    try {
      // Get work order
      const { data: wo, error: woError } = await supabase
        .from('work_orders')
        .select('inventory_reserved, inventory_reservation_date')
        .eq('id', work_order_id)
        .single()
      
      if (woError) throw woError
      
      // Get reservations
      const reservations = await MovementService.getReservations(work_order_id)
      
      // Get part details for each reservation
      const reservationsWithDetails = await Promise.all(
        reservations.map(async (res) => {
          const { data: part } = await supabase
            .from('inventory_parts')
            .select('part_number, name')
            .eq('id', res.part_id)
            .single()
          
          const { data: warehouse } = await supabase
            .from('inventory_warehouses')
            .select('name')
            .eq('id', res.warehouse_id)
            .single()
          
          const days_reserved = Math.floor(
            (new Date().getTime() - new Date(res.movement_date).getTime()) / (1000 * 60 * 60 * 24)
          )
          
          return {
            movement_id: res.id,
            part_id: res.part_id,
            part_number: part?.part_number || '',
            part_name: part?.name || '',
            warehouse_id: res.warehouse_id,
            warehouse_name: warehouse?.name || '',
            reserved_quantity: res.quantity,
            reserved_date: res.movement_date,
            days_reserved
          }
        })
      )
      
      const total_units_reserved = reservations.reduce((sum, r) => sum + r.quantity, 0)
      const oldest_reservation_days = reservationsWithDetails.length > 0
        ? Math.max(...reservationsWithDetails.map(r => r.days_reserved))
        : 0
      
      return {
        work_order_id,
        inventory_reserved: wo.inventory_reserved || false,
        reservations: reservationsWithDetails,
        summary: {
          total_parts_reserved: reservations.length,
          total_units_reserved,
          oldest_reservation_days
        }
      }
    } catch (error) {
      console.error('Error getting reservation status:', error)
      throw new Error('Failed to get reservation status')
    }
  }
}
