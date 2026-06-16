import type { TirePosition } from '@/types/tires'

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

export function getPositionByCode(code: string): TirePosition | undefined {
  return [...TRUCK_6WHEEL_POSITIONS, ...VEHICLE_4WHEEL_POSITIONS].find((p) => p.code === code)
}

export const PRESSURE_RANGE_PSI = { min: 80, max: 120 } as const
export const DEFAULT_MIN_TREAD_MM = 3.0

export function isTreadLow(treadMm: number | null | undefined, minMm: number): boolean {
  if (treadMm == null) return false
  return treadMm <= minMm
}

export function isPressureOutOfRange(psi: number | null | undefined): boolean {
  if (psi == null) return false
  return psi < PRESSURE_RANGE_PSI.min || psi > PRESSURE_RANGE_PSI.max
}
