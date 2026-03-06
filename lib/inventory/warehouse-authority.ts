/**
 * Warehouse authority helpers.
 * Resolves inventory permissions from warehouse_responsibilities + legacy role fallback.
 */

import { createClient } from '@/lib/supabase-server'
import { resolveWarehouseResponsibility } from '@/lib/auth/warehouse-responsibility'

export interface WarehouseAuthorityInput {
  userId: string
  warehouseId?: string | null
  plantId?: string | null
}

export interface WarehouseAuthorityResult {
  canReleaseInventory: boolean
  canReceiveInventory: boolean
  canAdjustInventory: boolean
  isWarehouseResponsible: boolean
  source: 'explicit_assignment' | 'legacy_role_fallback' | 'none'
  hasExplicitAssignment: boolean
}

export async function resolveWarehouseAuthority(
  input: WarehouseAuthorityInput
): Promise<WarehouseAuthorityResult> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', input.userId)
    .single()

  const legacyResult = resolveWarehouseResponsibility({ role: profile?.role ?? null })

  const now = new Date().toISOString()
  const { data: rows } = await supabase
    .from('warehouse_responsibilities')
    .select('warehouse_id, plant_id, can_release_inventory, can_receive_inventory, can_adjust_inventory')
    .eq('user_id', input.userId)
    .lte('effective_from', now)
    .or(`effective_until.is.null,effective_until.gte.${now}`)

  const assignments = (rows || []).filter((r) => {
    if (input.warehouseId && r.warehouse_id && r.warehouse_id !== input.warehouseId) return false
    if (input.plantId && r.plant_id && r.plant_id !== input.plantId) return false
    return true
  })

  if (assignments.length > 0) {
    const anyRelease = assignments.some((a) => a.can_release_inventory)
    const anyReceive = assignments.some((a) => a.can_receive_inventory)
    const anyAdjust = assignments.some((a) => a.can_adjust_inventory)
    return {
      canReleaseInventory: anyRelease || legacyResult.canReleaseInventory,
      canReceiveInventory: anyReceive || legacyResult.canReceiveInventory,
      canAdjustInventory: anyAdjust || legacyResult.canAdjustInventory,
      isWarehouseResponsible: anyRelease || anyReceive || anyAdjust || legacyResult.isWarehouseResponsible,
      source: 'explicit_assignment',
      hasExplicitAssignment: true,
    }
  }

  return {
    ...legacyResult,
    source: legacyResult.source as 'legacy_role_fallback' | 'none',
    hasExplicitAssignment: false,
  }
}

export async function canUserReleaseInventory(
  userId: string,
  warehouseId?: string | null,
  plantId?: string | null
): Promise<boolean> {
  const r = await resolveWarehouseAuthority({ userId, warehouseId, plantId })
  return r.canReleaseInventory
}

export async function canUserReceiveInventory(
  userId: string,
  warehouseId?: string | null,
  plantId?: string | null
): Promise<boolean> {
  const r = await resolveWarehouseAuthority({ userId, warehouseId, plantId })
  return r.canReceiveInventory
}

export async function canUserAdjustInventory(
  userId: string,
  warehouseId?: string | null,
  plantId?: string | null
): Promise<boolean> {
  const r = await resolveWarehouseAuthority({ userId, warehouseId, plantId })
  return r.canAdjustInventory
}
