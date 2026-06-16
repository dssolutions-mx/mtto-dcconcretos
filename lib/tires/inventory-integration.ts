import type { SupabaseClient } from '@supabase/supabase-js'
import { MovementService } from '@/lib/services/movement-service'
import { StockService } from '@/lib/services/stock-service'

export function isTireSkuLabel(name: string): boolean {
  return /llanta|neum[aá]tico/i.test(name)
}

export interface TireReceiptUnit {
  serial_number?: string | null
  brand?: string | null
  model?: string | null
  size?: string | null
}

export async function createTiresFromReceipt(
  supabase: SupabaseClient,
  params: {
    purchase_order_id: string
    supplier_id?: string | null
    part_id: string
    warehouse_id: string
    plant_id?: string | null
    unit_cost: number
    quantity: number
    part_name: string
    tire_units?: TireReceiptUnit[]
    user_id: string
  }
): Promise<string[]> {
  const created: string[] = []
  const qty = Math.max(1, Math.floor(params.quantity))
  const defaultBrand = params.part_name.split(' ')[0] ?? 'Llanta'
  const sizeMatch = params.part_name.match(/\d{2,3}[\/\s]?R?\d{2}/i)

  for (let i = 0; i < qty; i++) {
    const unit = params.tire_units?.[i]
    const { data, error } = await supabase
      .from('tires')
      .insert({
        serial_number: unit?.serial_number?.trim() || null,
        brand: unit?.brand?.trim() || defaultBrand,
        model: unit?.model?.trim() || null,
        size: unit?.size?.trim() || sizeMatch?.[0] || params.part_name,
        purchase_cost: params.unit_cost,
        purchase_date: new Date().toISOString().slice(0, 10),
        purchase_order_id: params.purchase_order_id,
        supplier_id: params.supplier_id ?? null,
        inventory_part_id: params.part_id,
        warehouse_id: params.warehouse_id,
        plant_id: params.plant_id ?? null,
        po_line_index: i,
        status: 'en_almacen',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[tires] create from receipt', error)
      continue
    }
    created.push(data.id)
  }

  return created
}

export async function issueTireFromInventory(
  supabase: SupabaseClient,
  params: {
    tire_id: string
    work_order_id?: string | null
    user_id: string
    notes?: string
  }
): Promise<{ movement_id?: string; skipped: boolean; reason?: string }> {
  const { data: tire, error } = await supabase
    .from('tires')
    .select('id, inventory_part_id, warehouse_id, purchase_cost, status')
    .eq('id', params.tire_id)
    .single()

  if (error || !tire) {
    return { skipped: true, reason: 'tire_not_found' }
  }
  if (!tire.inventory_part_id || !tire.warehouse_id) {
    return { skipped: true, reason: 'no_inventory_link' }
  }
  if (tire.status !== 'en_almacen') {
    return { skipped: true, reason: 'not_in_stock' }
  }

  const stock = await StockService.getOrCreateStock(tire.inventory_part_id, tire.warehouse_id)
  const movement = await MovementService.createMovement({
    part_id: tire.inventory_part_id,
    stock_id: stock.id,
    warehouse_id: tire.warehouse_id,
    movement_type: 'issue',
    quantity: 1,
    unit_cost: tire.purchase_cost ?? undefined,
    work_order_id: params.work_order_id ?? undefined,
    reference_type: 'work_order',
    reference_id: params.work_order_id ?? undefined,
    performed_by: params.user_id,
    movement_date: new Date().toISOString(),
    notes: params.notes ?? 'Emisión de llanta para montaje',
  })

  return { movement_id: movement.id, skipped: false }
}

export async function returnTireToInventory(
  supabase: SupabaseClient,
  params: {
    tire_id: string
    work_order_id?: string | null
    user_id: string
    notes?: string
  }
): Promise<{ movement_id?: string; skipped: boolean; reason?: string }> {
  const { data: tire, error } = await supabase
    .from('tires')
    .select('id, inventory_part_id, warehouse_id, purchase_cost')
    .eq('id', params.tire_id)
    .single()

  if (error || !tire?.inventory_part_id || !tire.warehouse_id) {
    return { skipped: true, reason: 'no_inventory_link' }
  }

  const stock = await StockService.getOrCreateStock(tire.inventory_part_id, tire.warehouse_id)
  const movement = await MovementService.createMovement({
    part_id: tire.inventory_part_id,
    stock_id: stock.id,
    warehouse_id: tire.warehouse_id,
    movement_type: 'return',
    quantity: 1,
    unit_cost: tire.purchase_cost ?? undefined,
    work_order_id: params.work_order_id ?? undefined,
    reference_type: 'work_order',
    reference_id: params.work_order_id ?? undefined,
    performed_by: params.user_id,
    movement_date: new Date().toISOString(),
    notes: params.notes ?? 'Devolución de llanta a almacén',
  })

  return { movement_id: movement.id, skipped: false }
}
