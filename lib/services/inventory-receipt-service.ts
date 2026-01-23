import { createClient } from '@/lib/supabase-server'
import { MovementService } from './movement-service'
import { StockService } from './stock-service'
import { InventoryService } from './inventory-service'

export interface ReceiptItem {
  po_item_id?: string // ID from PO items array
  part_id?: string // If part exists in catalog
  part_number?: string // If creating new part
  part_name: string
  warehouse_id: string
  quantity: number
  unit_cost: number
  notes?: string
}

export interface ReceiveToInventoryRequest {
  purchase_order_id: string
  items: ReceiptItem[]
  receipt_date?: string
  notes?: string
}

export interface ReceiptResult {
  movement_id: string
  part_id: string
  stock_id: string
  quantity: number
  success: boolean
  error_message?: string
  part_created?: boolean
}

export class InventoryReceiptService {
  /**
   * Receive purchase order items to inventory
   */
  static async receiveToInventory(
    request: ReceiveToInventoryRequest,
    user_id: string
  ): Promise<{
    movements_created: string[]
    parts_created: string[]
    total_items_received: number
    results: ReceiptResult[]
  }> {
    const supabase = await createClient()
    const movements_created: string[] = []
    const parts_created: string[] = []
    const results: ReceiptResult[] = []
    
    try {
      // Get purchase order
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', request.purchase_order_id)
        .single()
      
      if (poError) throw poError
      
      // Validate PO status
      if (!['purchased', 'received', 'validated'].includes(po.status)) {
        throw new Error('Purchase order must be purchased, received, or validated before receiving to inventory')
      }
      
      // Process each item
      for (const item of request.items) {
        try {
          let part_id = item.part_id
          
          // Create part if it doesn't exist
          if (!part_id && item.part_number) {
            const newPart = await InventoryService.createPart({
              part_number: item.part_number,
              name: item.part_name,
              category: 'Otro', // Default, user can update later
              unit_of_measure: 'pcs'
            }, user_id)
            
            part_id = newPart.id
            parts_created.push(part_id)
          } else if (!part_id) {
            // Try to find part by name
            const parts = await InventoryService.searchPartsByNumber(item.part_name)
            if (parts.length > 0) {
              part_id = parts[0].id
            } else {
              // Create new part without part number
              const newPart = await InventoryService.createPart({
                part_number: `AUTO-${Date.now()}`,
                name: item.part_name,
                category: 'Otro',
                unit_of_measure: 'pcs'
              }, user_id)
              
              part_id = newPart.id
              parts_created.push(part_id)
            }
          }
          
          if (!part_id) {
            results.push({
              movement_id: '',
              part_id: '',
              stock_id: '',
              quantity: item.quantity,
              success: false,
              error_message: 'Could not create or find part'
            })
            continue
          }
          
          // Get or create stock entry
          const stock = await StockService.getOrCreateStock(part_id, item.warehouse_id)
          
          // Create receipt movement
          const movement = await MovementService.createMovement({
            part_id,
            stock_id: stock.id,
            warehouse_id: item.warehouse_id,
            movement_type: 'receipt',
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            purchase_order_id: request.purchase_order_id,
            reference_type: 'purchase_order',
            performed_by: user_id,
            movement_date: request.receipt_date || new Date().toISOString(),
            notes: item.notes || request.notes
          })
          
          movements_created.push(movement.id)
          
          results.push({
            movement_id: movement.id,
            part_id,
            stock_id: stock.id,
            quantity: item.quantity,
            success: true,
            part_created: parts_created.includes(part_id)
          })
        } catch (error) {
          console.error(`Error receiving item ${item.part_name}:`, error)
          results.push({
            movement_id: '',
            part_id: item.part_id || '',
            stock_id: '',
            quantity: item.quantity,
            success: false,
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      // Update purchase order
      const received_items_summary = request.items.map((item, index) => ({
        item_index: index,
        ordered_qty: item.quantity, // This should come from PO, simplified here
        received_qty: item.quantity,
        remaining_qty: 0
      }))
      
      await supabase
        .from('purchase_orders')
        .update({
          received_to_inventory: true,
          received_to_inventory_date: request.receipt_date || new Date().toISOString(),
          received_to_inventory_by: user_id,
          received_items_summary,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.purchase_order_id)
      
      // Generate receipt number
      const { data: receiptNumberData } = await supabase.rpc('generate_inventory_receipt_number', {
        po_order_id: po.order_id
      })
      
      const total_value = request.items.reduce((sum, item) => 
        sum + (item.quantity * item.unit_cost), 0
      )
      
      // Get primary warehouse (first item's warehouse or most common)
      const warehouseCounts = new Map<string, number>()
      request.items.forEach(item => {
        warehouseCounts.set(item.warehouse_id, (warehouseCounts.get(item.warehouse_id) || 0) + 1)
      })
      const primaryWarehouse = Array.from(warehouseCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || request.items[0]?.warehouse_id
      
      await supabase
        .from('po_inventory_receipts')
        .insert({
          purchase_order_id: request.purchase_order_id,
          receipt_number: receiptNumberData || `REC-${po.order_id}-001`,
          receipt_date: request.receipt_date || new Date().toISOString(),
          warehouse_id: primaryWarehouse,
          items: request.items.map((item, index) => ({
            po_item_index: index,
            part_id: item.part_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost
          })),
          total_items: request.items.length,
          total_value,
          received_by: user_id,
          notes: request.notes
        })
      
      return {
        movements_created,
        parts_created,
        total_items_received: results.filter(r => r.success).length,
        results
      }
    } catch (error) {
      console.error('Error receiving to inventory:', error)
      throw new Error('Failed to receive to inventory')
    }
  }
  
  /**
   * Get receipt history for a purchase order
   */
  static async getReceiptHistory(purchase_order_id: string): Promise<any[]> {
    const supabase = await createClient()
    
    try {
      const { data, error } = await supabase
        .from('po_inventory_receipts')
        .select(`
          *,
          warehouse:inventory_warehouses(id, name, warehouse_code),
          received_by_user:profiles!po_inventory_receipts_received_by_fkey(id, nombre, apellido)
        `)
        .eq('purchase_order_id', purchase_order_id)
        .order('receipt_date', { ascending: false })
      
      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error('Error fetching receipt history:', error)
      throw new Error('Failed to fetch receipt history')
    }
  }
}
