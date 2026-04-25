/**
 * Padrón de proveedores is scoped by business unit. This resolves the BU for the
 * current purchase flow so we don't use `userPlants[0]` when the order is for another plant.
 */
export function resolveBusinessUnitIdForSupplierPadron(
  userPlants: Array<{ plant_id: string; business_unit_id?: string | null }>,
  context: {
    hasWorkOrder: boolean
    workOrderPlantId?: string | null
    workOrderAssetPlantId?: string | null
    selectedPlantIdForStandalone?: string
  }
): string | undefined {
  if (context.hasWorkOrder) {
    const pid = context.workOrderPlantId || context.workOrderAssetPlantId
    if (pid) {
      return userPlants.find((p) => p.plant_id === pid)?.business_unit_id ?? undefined
    }
  } else {
    const sid = context.selectedPlantIdForStandalone?.trim()
    if (sid) {
      return userPlants.find((p) => p.plant_id === sid)?.business_unit_id ?? undefined
    }
  }
  return userPlants[0]?.business_unit_id ?? undefined
}
