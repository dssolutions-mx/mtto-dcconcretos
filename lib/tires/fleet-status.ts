import type { TireFleetModuleState } from '@/types/tires'

export type TireUiRole = 'supervisor' | 'warehouse' | 'mechanic'

export type AssetTireSubState =
  | 'no-layout'
  | 'no-stock'
  | 'ready-to-mount'
  | 'partial'
  | 'complete'

const MECHANIC_ROLES = new Set(['OPERADOR', 'DOSIFICADOR'])
const WAREHOUSE_ROLES = new Set(['AUXILIAR_COMPRAS', 'ENCARGADO_ALMACEN'])

export function getTireUiRole(role: string | undefined | null): TireUiRole {
  if (!role) return 'supervisor'
  if (MECHANIC_ROLES.has(role)) return 'mechanic'
  if (WAREHOUSE_ROLES.has(role) || role === 'AREA_ADMINISTRATIVA') return 'warehouse'
  return 'supervisor'
}

export interface TireFleetKpis {
  assetsWithLayout: number
  totalRollingAssets: number
  positionsDefined: number
  warehouseCount: number
  mountedCount: number
  coveragePct: number
}

export interface TireFleetStatusSnapshot {
  state: TireFleetModuleState
  kpis: TireFleetKpis
  totalTires: number
}

export function computeCoveragePct(mountedPositions: number, totalPositions: number): number {
  if (totalPositions <= 0) return 0
  return Math.round((mountedPositions / totalPositions) * 100)
}

export function computeFleetModuleState(
  totalTires: number,
  coveragePct: number
): TireFleetModuleState {
  if (totalTires === 0) return 'empty'
  if (coveragePct >= 80) return 'operational'
  return 'partial'
}

export function computeAssetTireSubState(input: {
  hasExplicitLayout: boolean
  hasModel: boolean
  mountedCount: number
  totalPositions: number
  warehouseCount: number
}): AssetTireSubState {
  if (!input.hasModel || !input.hasExplicitLayout) return 'no-layout'
  if (input.mountedCount === 0 && input.warehouseCount === 0) return 'no-stock'
  if (input.mountedCount === 0 && input.warehouseCount > 0) return 'ready-to-mount'
  if (input.mountedCount < input.totalPositions) return 'partial'
  return 'complete'
}

export function buildFleetStatusSnapshot(input: {
  totalTires: number
  assetsWithLayout: number
  totalRollingAssets: number
  positionsDefined: number
  warehouseCount: number
  mountedCount: number
  totalMountSlots: number
}): TireFleetStatusSnapshot {
  const coveragePct = computeCoveragePct(input.mountedCount, input.totalMountSlots)
  return {
    state: computeFleetModuleState(input.totalTires, coveragePct),
    totalTires: input.totalTires,
    kpis: {
      assetsWithLayout: input.assetsWithLayout,
      totalRollingAssets: input.totalRollingAssets,
      positionsDefined: input.positionsDefined,
      warehouseCount: input.warehouseCount,
      mountedCount: input.mountedCount,
      coveragePct,
    },
  }
}
