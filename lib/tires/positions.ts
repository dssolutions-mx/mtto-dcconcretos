import type { TireLayoutTemplateKey, TirePosition, TireThresholds } from '@/types/tires'

/** Standard 6-wheel truck layout (3 axles). */
export const TRUCK_6WHEEL_POSITIONS: TirePosition[] = [
  { code: 'eje1_izq', label: 'Eje 1 — Izquierda', axle: 1, side: 'izq' },
  { code: 'eje1_der', label: 'Eje 1 — Derecha', axle: 1, side: 'der' },
  { code: 'eje2_izq_int', label: 'Eje 2 — Izq. interior', axle: 2, side: 'izq' },
  { code: 'eje2_izq_ext', label: 'Eje 2 — Izq. exterior', axle: 2, side: 'izq' },
  { code: 'eje2_der_int', label: 'Eje 2 — Der. interior', axle: 2, side: 'der' },
  { code: 'eje2_der_ext', label: 'Eje 2 — Der. exterior', axle: 2, side: 'der' },
  { code: 'eje3_izq_int', label: 'Eje 3 — Izq. interior', axle: 3, side: 'izq' },
  { code: 'eje3_izq_ext', label: 'Eje 3 — Izq. exterior', axle: 3, side: 'izq' },
  { code: 'eje3_der_int', label: 'Eje 3 — Der. interior', axle: 3, side: 'der' },
  { code: 'eje3_der_ext', label: 'Eje 3 — Der. exterior', axle: 3, side: 'der' },
]

/** Simple 4-wheel layout for loaders / smaller units. */
export const VEHICLE_4WHEEL_POSITIONS: TirePosition[] = [
  { code: 'del_izq', label: 'Delantera izquierda', axle: 1, side: 'izq' },
  { code: 'del_der', label: 'Delantera derecha', axle: 1, side: 'der' },
  { code: 'tras_izq', label: 'Trasera izquierda', axle: 2, side: 'izq' },
  { code: 'tras_der', label: 'Trasera derecha', axle: 2, side: 'der' },
]

export const DEFAULT_TIRE_POSITIONS = TRUCK_6WHEEL_POSITIONS

/** Template catalog keyed by template_key (DB fallback during migration). */
export const TIRE_LAYOUT_TEMPLATES: Record<
  Exclude<TireLayoutTemplateKey, 'custom'>,
  TirePosition[]
> = {
  truck_6x4: TRUCK_6WHEEL_POSITIONS,
  vehicle_4wheel: VEHICLE_4WHEEL_POSITIONS,
}

export function getPositionsForTemplate(templateKey: TireLayoutTemplateKey): TirePosition[] {
  if (templateKey === 'custom') return []
  return TIRE_LAYOUT_TEMPLATES[templateKey] ?? DEFAULT_TIRE_POSITIONS
}

export function getAllKnownPositions(): TirePosition[] {
  return [...TRUCK_6WHEEL_POSITIONS, ...VEHICLE_4WHEEL_POSITIONS]
}

export function getPositionByCode(code: string): TirePosition | undefined {
  return getAllKnownPositions().find((p) => p.code === code)
}

export const PRESSURE_RANGE_PSI = { min: 80, max: 120 } as const
export const DEFAULT_MIN_TREAD_MM = 3.0

export function isTreadLow(treadMm: number | null | undefined, minMm: number): boolean {
  if (treadMm == null) return false
  return treadMm <= minMm
}

export function resolvePressureRange(thresholds?: TireThresholds): {
  min: number
  max: number
} {
  return {
    min: thresholds?.pressure_min_psi ?? PRESSURE_RANGE_PSI.min,
    max: thresholds?.pressure_max_psi ?? PRESSURE_RANGE_PSI.max,
  }
}

export function isPressureOutOfRange(
  psi: number | null | undefined,
  thresholds?: TireThresholds
): boolean {
  if (psi == null) return false
  const range = resolvePressureRange(thresholds)
  return psi < range.min || psi > range.max
}
