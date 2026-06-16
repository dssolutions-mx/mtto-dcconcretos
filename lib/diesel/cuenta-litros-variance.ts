/** Liters — cuenta litros movement vs registered quantity tolerance (±2L). */
export const CUENTA_LITROS_VARIANCE_TOLERANCE_LITERS = 2

export type CuentaLitrosVarianceResult = {
  movement: number
  variance: number
  withinTolerance: boolean
  expectedCuentaLitros: number
}

export function computeCuentaLitrosVariance(
  previousCuentaLitros: number,
  currentCuentaLitros: number,
  quantityLiters: number,
  toleranceLiters: number = CUENTA_LITROS_VARIANCE_TOLERANCE_LITERS,
): CuentaLitrosVarianceResult {
  const movement = currentCuentaLitros - previousCuentaLitros
  const variance = Math.abs(movement - quantityLiters)
  return {
    movement,
    variance,
    withinTolerance: variance <= toleranceLiters,
    expectedCuentaLitros: previousCuentaLitros + quantityLiters,
  }
}

export function shouldRequireValidationForCuentaLitrosVariance(
  previousCuentaLitros: number | null | undefined,
  currentCuentaLitros: number | null | undefined,
  quantityLiters: number | null | undefined,
  toleranceLiters: number = CUENTA_LITROS_VARIANCE_TOLERANCE_LITERS,
): boolean {
  if (
    previousCuentaLitros == null ||
    currentCuentaLitros == null ||
    quantityLiters == null ||
    !Number.isFinite(previousCuentaLitros) ||
    !Number.isFinite(currentCuentaLitros) ||
    !Number.isFinite(quantityLiters)
  ) {
    return false
  }

  return !computeCuentaLitrosVariance(
    previousCuentaLitros,
    currentCuentaLitros,
    quantityLiters,
    toleranceLiters,
  ).withinTolerance
}
