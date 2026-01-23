import { createClient } from '@/lib/supabase-server'
import { MovementService } from './movement-service'
import { StockService } from './stock-service'

export interface FulfillmentItem {
  po_item_id: string
  part_id: string
  warehouse_id: string
  quantity: number
  unit_cost?: number // Uses inventory cost if not provided
}

export interface FulfillFromInventoryRequest {
  purchase_order_id: string
  fulfillments: FulfillmentItem[]
  fulfillment_date?: string
  notes?: string
}

export interface FulfillmentResult {
  movement_id: string
  part_id: string
  warehouse_id: string
  quantity: number
  success: boolean
  error_message?: string
}

export class InventoryFulfillmentService {
  /**
   * Fulfill purchase order from inventory
   */
  static async fulfillFromInventory(
    request: FulfillFromInventoryRequest,
    user_id: string
  ): Promise<{
    movements_created: string[]
    items_fulfilled: number
    remaining_items: number
    results: FulfillmentResult[]
  }> {
    const supabase = await createClient()
    const movements_created: string[] = []
    const results: FulfillmentResult[] = []
    
    try {
      // Get purchase order
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', request.purchase_order_id)
        .single()
      
      if (poError) throw poError
      
      // Process each fulfillment
      for (const fulfillment of request.fulfillments) {
        try {
          // Get stock
          const stock = await StockService.getOrCreateStock(
            fulfillment.part_id,
            fulfillment.warehouse_id
          )
          
          // Verify availability
          const available = stock.current_quantity - stock.reserved_quantity
          if (available < fulfillment.quantity) {
            results.push({
              movement_id: '',
              part_id: fulfillment.part_id,
              warehouse_id: fulfillment.warehouse_id,
              quantity: fulfillment.quantity,
              success: false,
              error_message: `Insufficient stock. Available: ${available}, Requested: ${fulfillment.quantity}`
            })
            continue
          }
          
          // Use provided cost or inventory average cost
          const unit_cost = fulfillment.unit_cost || stock.average_unit_cost || 0
          
          // Create issue movement (negative quantity)
          const movement = await MovementService.createMovement({
            part_id: fulfillment.part_id,
            stock_id: stock.id,
            warehouse_id: fulfillment.warehouse_id,
            movement_type: 'issue',
            quantity: -fulfillment.quantity, // Negative for issue
            unit_cost,
            purchase_order_id: request.purchase_order_id,
            reference_type: 'purchase_order',
            performed_by: user_id,
            movement_date: request.fulfillment_date || new Date().toISOString(),
            notes: request.notes
          })
          
          movements_created.push(movement.id)
          
          results.push({
            movement_id: movement.id,
            part_id: fulfillment.part_id,
            warehouse_id: fulfillment.warehouse_id,
            quantity: fulfillment.quantity,
            success: true
          })
        } catch (error) {
          console.error(`Error fulfilling part ${fulfillment.part_id}:`, error)
          results.push({
            movement_id: '',
            part_id: fulfillment.part_id,
            warehouse_id: fulfillment.warehouse_id,
            quantity: fulfillment.quantity,
            success: false,
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      // Determine fulfillment source
      const all_items_fulfilled = results.every(r => r.success)
      const some_items_fulfilled = results.some(r => r.success)
      
      const fulfillment_source = all_items_fulfilled 
        ? 'inventory' 
        : some_items_fulfilled 
          ? 'mixed' 
          : 'purchase'
      
      // Update purchase order
      await supabase
        .from('purchase_orders')
        .update({
          inventory_fulfilled: some_items_fulfilled,
          inventory_fulfillment_date: request.fulfillment_date || new Date().toISOString(),
          inventory_fulfilled_by: user_id,
          fulfillment_source,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.purchase_order_id)
      
      const items_fulfilled = results.filter(r => r.success).length
      const remaining_items = request.fulfillments.length - items_fulfilled
      
      return {
        movements_created,
        items_fulfilled,
        remaining_items,
        results
      }
    } catch (error) {
      console.error('Error fulfilling from inventory:', error)
      throw new Error('Failed to fulfill from inventory')
    }
  }
  
  /**
   * Check inventory availability for purchase order items
   */
  static async checkPOAvailability(purchase_order_id: string): Promise<Array<{
    po_item_id: string
    part_id?: string
    part_number?: string
    part_name: string
    required_quantity: number
    availability: {
      part_id: string
      part_number: string
      part_name: string
      required_quantity: number
      available_by_warehouse: Array<{
        warehouse_id: string
        warehouse_name: string
        available_quantity: number
        current_quantity: number
        reserved_quantity: number
      }>
      total_available: number
      sufficient: boolean
    }
  }>> {
    const supabase = await createClient()
    
    try {
      // Get purchase order
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('items, plant_id')
        .eq('id', purchase_order_id)
        .single()
      
      if (poError) throw poError
      
      const items = po.items as any[] || []
      const results = []
      
      for (const item of items) {
        // Try to match part
        let part_id: string | undefined
        if (item.partNumber) {
          const parts = await (await createClient())
            .from('inventory_parts')
            .select('id, part_number, name')
            .eq('part_number', item.partNumber)
            .eq('is_active', true)
            .limit(1)
          
          if (parts.data && parts.data.length > 0) {
            part_id = parts.data[0].id
          }
        }
        
        if (part_id && po.plant_id) {
          // Check availability
          const availability = await StockService.checkAvailability(
            part_id,
            po.plant_id,
            item.quantity || 0
          )
          
          const total_available = availability.reduce((sum, a) => sum + a.available_quantity, 0)
          
          results.push({
            po_item_id: item.id || item.partNumber,
            part_id,
            part_number: item.partNumber,
            part_name: item.name,
            required_quantity: item.quantity || 0,
            availability: {
              part_id,
              part_number: item.partNumber || '',
              part_name: item.name,
              required_quantity: item.quantity || 0,
              available_by_warehouse: availability.map(a => ({
                warehouse_id: a.warehouse_id,
                warehouse_name: a.warehouse_name,
                available_quantity: a.available_quantity,
                current_quantity: a.current_quantity,
                reserved_quantity: a.reserved_quantity
              })),
              total_available,
              sufficient: total_available >= (item.quantity || 0)
            }
          })
        } else {
          // Part not in catalog
          results.push({
            po_item_id: item.id || item.partNumber,
            part_name: item.name,
            required_quantity: item.quantity || 0,
            availability: {
              part_id: '',
              part_number: item.partNumber || '',
              part_name: item.name,
              required_quantity: item.quantity || 0,
              available_by_warehouse: [],
              total_available: 0,
              sufficient: false
            }
          })
        }
      }
      
      return results
    } catch (error) {
      console.error('Error checking PO availability:', error)
      throw new Error('Failed to check PO availability')
    }
  }
}
