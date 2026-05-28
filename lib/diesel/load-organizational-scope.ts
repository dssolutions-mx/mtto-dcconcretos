import type { SupabaseClient } from '@supabase/supabase-js'

export type DieselOrgProfile = {
  plant_id: string | null
  business_unit_id: string | null
  role?: string | null
}

export type DieselWarehouseOption = {
  id: string
  name: string
  warehouse_code: string
  capacity_liters: number
  current_inventory: number | null
  has_cuenta_litros: boolean
  plant_id: string
}

export type DieselOrganizationalLoadResult = {
  accessProfile: { business_unit_id: string | null; plant_id: string | null }
  businessUnits: Array<{ id: string; name: string; [key: string]: unknown }>
  plants: Array<{ id: string; name: string; code?: string; [key: string]: unknown }>
  warehouses: DieselWarehouseOption[]
  allBuWarehouses: DieselWarehouseOption[]
  selectedBusinessUnit: string | null
  selectedPlant: string | null
  selectedWarehouse: string | null
}

const WAREHOUSE_SELECT =
  'id, name, warehouse_code, capacity_liters, current_inventory, has_cuenta_litros, plant_id'

export async function fetchDieselWarehousesForPlant(
  supabase: SupabaseClient,
  plantId: string,
  productType: 'diesel' | 'urea'
): Promise<DieselWarehouseOption[]> {
  const { data, error } = await supabase
    .from('diesel_warehouses')
    .select(WAREHOUSE_SELECT)
    .eq('plant_id', plantId)
    .eq('product_type', productType)
    .order('name')

  if (error) {
    console.error('Error loading warehouses for plant:', error)
    throw error
  }

  return (data ?? []) as DieselWarehouseOption[]
}

export async function fetchDieselWarehousesForBusinessUnit(
  supabase: SupabaseClient,
  businessUnitId: string,
  productType: 'diesel' | 'urea'
): Promise<DieselWarehouseOption[]> {
  const { data: plantRows, error: plantErr } = await supabase
    .from('plants')
    .select('id')
    .eq('business_unit_id', businessUnitId)

  if (plantErr) {
    console.error('Error loading plants for BU warehouses:', plantErr)
    throw plantErr
  }

  const plantIds = (plantRows ?? []).map((p) => p.id).filter(Boolean)
  if (plantIds.length === 0) return []

  const { data, error } = await supabase
    .from('diesel_warehouses')
    .select(WAREHOUSE_SELECT)
    .in('plant_id', plantIds)
    .eq('product_type', productType)
    .order('name')

  if (error) {
    console.error('Error loading BU warehouses:', error)
    throw error
  }

  return (data ?? []) as DieselWarehouseOption[]
}

function autoSelectWarehouse(
  list: DieselWarehouseOption[]
): string | null {
  return list.length === 1 ? list[0].id : null
}

/**
 * Loads BU/plant/warehouse options for diesel forms from the current user's profile.
 * Handles plant-only profiles (plant_id without business_unit_id).
 */
export async function loadDieselOrganizationalScope(
  supabase: SupabaseClient,
  profile: DieselOrgProfile,
  productType: 'diesel' | 'urea'
): Promise<DieselOrganizationalLoadResult> {
  const accessProfile = {
    business_unit_id: profile.business_unit_id ?? null,
    plant_id: profile.plant_id ?? null,
  }

  const { data: busUnits } = await supabase.from('business_units').select('*').order('name')

  const empty: DieselOrganizationalLoadResult = {
    accessProfile,
    businessUnits: (busUnits ?? []) as DieselOrganizationalLoadResult['businessUnits'],
    plants: [],
    warehouses: [],
    allBuWarehouses: [],
    selectedBusinessUnit: null,
    selectedPlant: null,
    selectedWarehouse: null,
  }

  if (profile.business_unit_id) {
    const { data: buPlants } = await supabase
      .from('plants')
      .select('*')
      .eq('business_unit_id', profile.business_unit_id)
      .order('name')

    if (profile.plant_id) {
      const warehouses = await fetchDieselWarehousesForPlant(
        supabase,
        profile.plant_id,
        productType
      )
      return {
        ...empty,
        plants: (buPlants ?? []) as DieselOrganizationalLoadResult['plants'],
        warehouses,
        allBuWarehouses: [],
        selectedBusinessUnit: profile.business_unit_id,
        selectedPlant: profile.plant_id,
        selectedWarehouse: autoSelectWarehouse(warehouses),
      }
    }

    const allBuWarehouses = await fetchDieselWarehousesForBusinessUnit(
      supabase,
      profile.business_unit_id,
      productType
    )
    return {
      ...empty,
      plants: (buPlants ?? []) as DieselOrganizationalLoadResult['plants'],
      warehouses: allBuWarehouses,
      allBuWarehouses,
      selectedBusinessUnit: profile.business_unit_id,
      selectedPlant: null,
      selectedWarehouse: autoSelectWarehouse(allBuWarehouses),
    }
  }

  if (profile.plant_id) {
    const { data: plantRow } = await supabase
      .from('plants')
      .select('*')
      .eq('id', profile.plant_id)
      .maybeSingle()

    const warehouses = await fetchDieselWarehousesForPlant(
      supabase,
      profile.plant_id,
      productType
    )

    const plants = plantRow ? [plantRow] : []
    const buFromPlant =
      plantRow && typeof plantRow === 'object' && 'business_unit_id' in plantRow
        ? (plantRow.business_unit_id as string | null)
        : null

    return {
      ...empty,
      plants: plants as DieselOrganizationalLoadResult['plants'],
      warehouses,
      allBuWarehouses: [],
      selectedBusinessUnit: buFromPlant,
      selectedPlant: profile.plant_id,
      selectedWarehouse: autoSelectWarehouse(warehouses),
    }
  }

  const { data: allPlants } = await supabase.from('plants').select('*').order('name')

  return {
    ...empty,
    plants: (allPlants ?? []) as DieselOrganizationalLoadResult['plants'],
  }
}

/** Roles that cannot create diesel/urea warehouses (matches DB INSERT policy). */
export function canCreateFuelWarehouse(role: string | null | undefined): boolean {
  if (!role) return false
  return !['DOSIFICADOR', 'OPERADOR', 'MECANICO', 'VISUALIZADOR'].includes(role)
}

export type DieselHubEmptyReason = 'no_plant' | 'no_warehouses' | null

export function getDieselHubEmptyReason(
  plantIds: string[] | null,
  warehouseCount: number
): DieselHubEmptyReason {
  if (plantIds !== null && plantIds.length === 0) return 'no_plant'
  if (warehouseCount === 0) return 'no_warehouses'
  return null
}

export function dieselHubEmptyMessage(reason: DieselHubEmptyReason): string | null {
  if (reason === 'no_plant') {
    return 'Tu usuario no tiene planta asignada. Contacta a tu jefe de planta para que actualicen tu perfil.'
  }
  if (reason === 'no_warehouses') {
    return 'No hay almacén de combustible configurado para tu planta. Pide a mantenimiento o administración que cree el almacén.'
  }
  return null
}
