import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildCuentaLitrosGaps,
  CUENTA_LITROS_GAP_AUDIT_FROM,
  getSignificantGaps,
  type CuentaLitrosGap,
  type GapTransactionInput,
} from '@/lib/diesel-cuenta-litros-gaps'

export type WarehouseGapContext = {
  warehouseId: string
  warehouseName: string
  warehouseCode: string
  plantId: string
  plantName: string
  plantCode: string | null
  hasCuentaLitros: boolean
  significantGaps: CuentaLitrosGap[]
}

export async function loadWarehouseGapContext(
  admin: SupabaseClient,
  warehouseId: string,
): Promise<WarehouseGapContext | { error: string; status: number }> {
  const { data: warehouse, error: whErr } = await admin
    .from('diesel_warehouses')
    .select(
      `
      id,
      name,
      warehouse_code,
      has_cuenta_litros,
      plant_id,
      product_type,
      plants!inner(id, name, code)
    `,
    )
    .eq('id', warehouseId)
    .eq('product_type', 'diesel')
    .maybeSingle()

  if (whErr) return { error: whErr.message, status: 500 }
  if (!warehouse) return { error: 'Almacén no encontrado', status: 404 }

  const plantsRaw = (warehouse as { plants?: { id: string; name: string; code: string | null } | { id: string; name: string; code: string | null }[] }).plants
  const plant = Array.isArray(plantsRaw) ? plantsRaw[0] : plantsRaw

  if (!warehouse.has_cuenta_litros) {
    return { error: 'Este almacén no tiene cuenta litros', status: 400 }
  }

  const { data: txRows, error: txErr } = await admin
    .from('diesel_transactions')
    .select(
      `
      id,
      transaction_id,
      transaction_type,
      quantity_liters,
      transaction_date,
      created_at,
      cuenta_litros,
      is_transfer,
      notes,
      asset_id,
      exception_asset_name,
      assets(name),
      diesel_products!inner(product_type)
    `,
    )
    .eq('warehouse_id', warehouseId)
    .eq('diesel_products.product_type', 'diesel')
    .order('transaction_date', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (txErr) return { error: txErr.message, status: 500 }

  const transactions: GapTransactionInput[] = (txRows ?? []).map((t) => {
    const assets = (t as { assets?: { name: string | null } | { name: string | null }[] | null }).assets
    const assetName = Array.isArray(assets) ? assets[0]?.name : assets?.name
    return {
      id: t.id,
      transaction_id: t.transaction_id,
      transaction_type: t.transaction_type,
      quantity_liters: Number(t.quantity_liters),
      transaction_date: t.transaction_date,
      created_at: t.created_at ?? undefined,
      cuenta_litros: t.cuenta_litros != null ? Number(t.cuenta_litros) : null,
      is_transfer: Boolean(t.is_transfer),
      notes: t.notes,
      asset_name: assetName ?? null,
      asset_id: t.asset_id ?? null,
      exception_asset_name: t.exception_asset_name ?? null,
    }
  })

  const gaps = buildCuentaLitrosGaps(transactions, {
    warehouse_id: warehouseId,
    has_cuenta_litros: true,
    audit_from: CUENTA_LITROS_GAP_AUDIT_FROM,
  })

  return {
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    warehouseCode: warehouse.warehouse_code,
    plantId: plant?.id ?? warehouse.plant_id,
    plantName: plant?.name ?? 'N/A',
    plantCode: plant?.code ?? null,
    hasCuentaLitros: true,
    significantGaps: getSignificantGaps(gaps),
  }
}

export function filterGapsByIds(
  gaps: CuentaLitrosGap[],
  gapIds: string[],
): CuentaLitrosGap[] | { error: string; status: number } {
  if (gapIds.length === 0) {
    return { error: 'Selecciona al menos un hueco', status: 400 }
  }
  const allowed = new Map(gaps.map((g) => [g.id, g]))
  const selected: CuentaLitrosGap[] = []
  for (const id of gapIds) {
    const gap = allowed.get(id)
    if (!gap) {
      return { error: `Hueco no válido para este almacén: ${id}`, status: 400 }
    }
    selected.push(gap)
  }
  return selected
}

export function gapsToAvailableFindings(gaps: CuentaLitrosGap[]) {
  return gaps.map((g) => ({
    findingKey: g.id,
    message: `${g.short_label} · ${g.prev_anchor.transaction_id} → ${g.curr_anchor.transaction_id} · ${g.time_window_label}`,
  }))
}
