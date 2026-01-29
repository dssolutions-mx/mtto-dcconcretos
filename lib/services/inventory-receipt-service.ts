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
      
      // Validate PO status - allow approved and later statuses
      const allowedStatuses = ['approved', 'purchased', 'received', 'validated', 'receipt_uploaded', 'ordered']
      if (!allowedStatuses.includes(po.status)) {
        throw new Error(`Purchase order must be approved or later (current status: ${po.status}) before receiving to inventory. Allowed statuses: ${allowedStatuses.join(', ')}`)
      }
      
      // Process each item
      for (const item of request.items) {
        try {
          console.log(`Processing receipt item:`, { part_name: item.part_name, warehouse_id: item.warehouse_id, quantity: item.quantity })
          
          let part_id = item.part_id
          
          // Create part if it doesn't exist
          if (!part_id && item.part_number) {
            console.log(`Creating part for ${item.part_number}`)
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
            console.log(`Searching for part: ${item.part_name}`)
            const parts = await InventoryService.searchPartsByNumber(item.part_name)
            if (parts.length > 0) {
              part_id = parts[0].id
            } else {
              // Create new part without part number
              console.log(`Creating new part without part number`)
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
            console.error(`Could not create or find part for ${item.part_name}`)
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
          
          console.log(`Got part_id: ${part_id}, getting/creating stock for warehouse: ${item.warehouse_id}`)
          // Get or create stock entry
          const stock = await StockService.getOrCreateStock(part_id, item.warehouse_id)
          console.log(`Got stock:`, { stock_id: stock.id, current_quantity: stock.current_quantity })
          
          // Create receipt movement
          console.log(`Creating receipt movement`)
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
          
          console.log(`Movement created:`, movement.id)
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
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          const errorDetails = error instanceof Error ? error.stack : String(error)
          console.error(`Error details:`, errorDetails)
          results.push({
            movement_id: '',
            part_id: item.part_id || '',
            stock_id: '',
            quantity: item.quantity,
            success: false,
            error_message: errorMessage
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
      
      // Update purchase order receipt status
      try {
        const updateData: any = {
          received_to_inventory: true,
          received_to_inventory_date: request.receipt_date || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        // Try to include optional fields if they exist
        try {
          updateData.received_to_inventory_by = user_id
          updateData.received_items_summary = received_items_summary
        } catch {
          // Fields may not exist, ignore
        }
        
        const { error: updateError } = await supabase
          .from('purchase_orders')
          .update(updateData)
          .eq('id', request.purchase_order_id)
        
        if (updateError) {
          console.error('Error updating PO receipt status:', updateError)
          // Don't fail the whole operation if PO update fails, but log it
        } else {
          console.log('PO receipt status updated successfully')
        }
      } catch (updateError) {
        console.warn('Error updating PO (non-critical):', updateError)
      }
      
      // Generate receipt number (optional, don't fail if RPC doesn't exist)
      let receiptNumber = `REC-${po.order_id}-${Date.now()}`
      try {
        const { data: receiptNumberData, error: rpcError } = await supabase.rpc('generate_inventory_receipt_number', {
          po_order_id: po.order_id
        })
        if (!rpcError && receiptNumberData) {
          receiptNumber = receiptNumberData
        }
      } catch (rpcError) {
        console.warn('RPC generate_inventory_receipt_number not available, using generated number:', rpcError)
      }
      
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
      
      // Insert receipt record (optional, don't fail if table doesn't exist)
      try {
        const { error: receiptError } = await supabase
          .from('po_inventory_receipts')
          .insert({
            purchase_order_id: request.purchase_order_id,
            receipt_number: receiptNumber,
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
        
        if (receiptError) {
          console.warn('Error creating receipt record (non-critical):', receiptError)
        }
      } catch (receiptError) {
        console.warn('po_inventory_receipts table may not exist (non-critical):', receiptError)
      }
      
      // Check if any items failed
      const failedItems = results.filter(r => !r.success)
      if (failedItems.length > 0 && movements_created.length === 0) {
        // If all items failed, throw error
        const errorMessages = failedItems.map(r => r.error_message).filter(Boolean).join('; ')
        throw new Error(`Failed to receive items: ${errorMessages}`)
      }
      
      return {
        movements_created,
        parts_created,
        total_items_received: results.filter(r => r.success).length,
        results
      }
    } catch (error) {
      console.error('Error receiving to inventory:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorDetails = error instanceof Error ? error.stack : String(error)
      console.error('Error stack:', errorDetails)
      throw new Error(`Failed to receive to inventory: ${errorMessage}`)
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
          warehouse:inventory_warehouses(id, name, warehouse_code)
        `)
        .eq('purchase_order_id', purchase_order_id)
        .order('receipt_date', { ascending: false })
      
      if (error) throw error
      
      const receipts = data || []
      
      // Fetch user profiles separately
      const userIds = [...new Set(receipts.map(r => r.received_by).filter(Boolean))]
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
      
      // Enrich receipts with profile data
      return receipts.map(receipt => ({
        ...receipt,
        received_by_user: receipt.received_by ? profilesMap.get(receipt.received_by) : null
      }))
    } catch (error) {
      console.error('Error fetching receipt history:', error)
      throw new Error('Failed to fetch receipt history')
    }
  }
}
