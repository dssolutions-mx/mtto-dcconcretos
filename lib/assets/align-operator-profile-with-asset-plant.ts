import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase-types'
import { shouldUpdateOperatorProfileForPlantTransfer } from '@/lib/assets/should-update-operator-profile-for-plant-transfer'

type DbClient = SupabaseClient<Database, 'public', any>

export type AlignOperatorProfileResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/**
 * Ensures the operator's profile plant matches the asset's plant when both exist.
 * Same-BU moves align automatically (mirrors plant-reassignment transfer_operators).
 * Cross-BU mismatch returns 409 so global roles cannot create silent drift.
 */
export async function alignOperatorProfileToAssetPlant(
  supabase: DbClient,
  adminClient: DbClient,
  params: { assetId: string; operatorId: string }
): Promise<AlignOperatorProfileResult> {
  const { data: asset, error: assetErr } = await supabase
    .from('assets')
    .select('id, plant_id, plants:plant_id(business_unit_id)')
    .eq('id', params.assetId)
    .maybeSingle()

  if (assetErr || !asset) {
    return { ok: false, status: 404, error: 'Activo no encontrado' }
  }

  const assetPlantId = asset.plant_id
  if (!assetPlantId) {
    return { ok: true }
  }

  const rawPlants = asset.plants as { business_unit_id: string | null } | { business_unit_id: string | null }[] | null
  const plantRow = Array.isArray(rawPlants) ? rawPlants[0] : rawPlants
  const assetBuId = plantRow?.business_unit_id ?? null

  const { data: op, error: opErr } = await supabase
    .from('profiles')
    .select('id, plant_id, business_unit_id')
    .eq('id', params.operatorId)
    .maybeSingle()

  if (opErr || !op) {
    return { ok: false, status: 404, error: 'Operador no encontrado' }
  }

  if (op.plant_id === assetPlantId) {
    return { ok: true }
  }

  if (
    !shouldUpdateOperatorProfileForPlantTransfer(
      { plant_id: op.plant_id, business_unit_id: op.business_unit_id },
      assetBuId
    )
  ) {
    return {
      ok: false,
      status: 409,
      error:
        'La planta del operador no coincide con la del activo y no puede alinearse automáticamente (unidad de negocio distinta). Actualiza el perfil del operador o reasigna.',
    }
  }

  const { error: updErr } = await adminClient
    .from('profiles')
    .update({
      plant_id: assetPlantId,
      business_unit_id: assetBuId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.operatorId)

  if (updErr) {
    console.error('alignOperatorProfileToAssetPlant', updErr)
    return { ok: false, status: 500, error: updErr.message }
  }

  return { ok: true }
}

/**
 * After an asset (or bundle) sits on `targetPlantId`, align every actively assigned operator
 * whose profile is still on another plant within the same BU. Covers `keep` conflict resolution
 * and any path that moved the asset without updating profiles.
 */
export async function syncAssignedOperatorProfilesToPlant(
  supabase: DbClient,
  adminClient: DbClient,
  params: { bundleAssetIds: string[]; targetPlantId: string | null }
): Promise<AlignOperatorProfileResult> {
  const { bundleAssetIds, targetPlantId } = params
  if (!targetPlantId || bundleAssetIds.length === 0) {
    return { ok: true }
  }

  const { data: destPlant, error: plantErr } = await supabase
    .from('plants')
    .select('id, business_unit_id')
    .eq('id', targetPlantId)
    .maybeSingle()

  if (plantErr || !destPlant) {
    return { ok: false, status: 404, error: 'Planta destino no encontrada' }
  }

  const destBuId = destPlant.business_unit_id ?? null

  const { data: rows, error: aoErr } = await supabase
    .from('asset_operators')
    .select('operator_id')
    .in('asset_id', bundleAssetIds)
    .eq('status', 'active')

  if (aoErr) {
    console.error('syncAssignedOperatorProfilesToPlant', aoErr)
    return { ok: false, status: 500, error: aoErr.message }
  }

  const operatorIds = [...new Set((rows ?? []).map((r) => r.operator_id).filter(Boolean))] as string[]

  for (const operatorId of operatorIds) {
    const { data: op, error: opErr } = await supabase
      .from('profiles')
      .select('id, plant_id, business_unit_id')
      .eq('id', operatorId)
      .maybeSingle()

    if (opErr || !op) continue
    if (op.plant_id === targetPlantId) continue

    if (
      !shouldUpdateOperatorProfileForPlantTransfer(
        { plant_id: op.plant_id, business_unit_id: op.business_unit_id },
        destBuId
      )
    ) {
      return {
        ok: false,
        status: 409,
        error:
          'Hay operadores asignados cuya planta de perfil no coincide con la del activo y no pueden alinearse automáticamente (unidad de negocio distinta). Desasigna o actualiza perfiles antes de mover.',
      }
    }

    const { error: updErr } = await adminClient
      .from('profiles')
      .update({
        plant_id: targetPlantId,
        business_unit_id: destBuId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', operatorId)

    if (updErr) {
      console.error('syncAssignedOperatorProfilesToPlant', operatorId, updErr)
      return { ok: false, status: 500, error: updErr.message }
    }
  }

  return { ok: true }
}
