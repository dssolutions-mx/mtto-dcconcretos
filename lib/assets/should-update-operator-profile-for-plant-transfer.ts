/** Used when applying `transfer_operators` after conflict checks (`canTransfer` true). */
export function shouldUpdateOperatorProfileForPlantTransfer(
  operator: { plant_id: string | null; business_unit_id: string | null },
  destinationBusinessUnitId: string | null
): boolean {
  if (!operator.plant_id) return true
  if (operator.business_unit_id == null) return true
  return operator.business_unit_id === destinationBusinessUnitId
}
