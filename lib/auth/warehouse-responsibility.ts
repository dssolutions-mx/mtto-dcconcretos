import { isLegacyDbRole, type LegacyDbRole } from '@/lib/auth/role-model'

export type WarehouseResponsibilitySource =
  | 'none'
  | 'legacy_role_fallback'
  | 'explicit_assignment'

export interface WarehouseResponsibilityInput {
  role?: string | null
  canReleaseInventory?: boolean | null
  canReceiveInventory?: boolean | null
  canAdjustInventory?: boolean | null
}

export interface WarehouseResponsibility {
  canReleaseInventory: boolean
  canReceiveInventory: boolean
  canAdjustInventory: boolean
  isWarehouseResponsible: boolean
  source: WarehouseResponsibilitySource
}

const LEGACY_WAREHOUSE_RESPONSIBILITY: Partial<
  Record<
    LegacyDbRole,
    Pick<
      WarehouseResponsibility,
      'canReleaseInventory' | 'canReceiveInventory' | 'canAdjustInventory'
    >
  >
> = {
  GERENCIA_GENERAL: {
    canReleaseInventory: true,
    canReceiveInventory: true,
    canAdjustInventory: true,
  },
  AREA_ADMINISTRATIVA: {
    canReleaseInventory: true,
    canReceiveInventory: true,
    canAdjustInventory: true,
  },
  AUXILIAR_COMPRAS: {
    canReleaseInventory: true,
    canReceiveInventory: true,
    canAdjustInventory: false,
  },
  ENCARGADO_ALMACEN: {
    canReleaseInventory: true,
    canReceiveInventory: true,
    canAdjustInventory: true,
  },
  JEFE_UNIDAD_NEGOCIO: {
    canReleaseInventory: true,
    canReceiveInventory: true,
    canAdjustInventory: true,
  },
  JEFE_PLANTA: {
    canReleaseInventory: true,
    canReceiveInventory: true,
    canAdjustInventory: false,
  },
  ENCARGADO_MANTENIMIENTO: {
    canReleaseInventory: true,
    canReceiveInventory: true,
    canAdjustInventory: false,
  },
  DOSIFICADOR: {
    canReleaseInventory: false,
    canReceiveInventory: true,
    canAdjustInventory: false,
  },
}

function resolveLegacyWarehouseFallback(
  role: string | null | undefined
): WarehouseResponsibility {
  const fallback = isLegacyDbRole(role) ? LEGACY_WAREHOUSE_RESPONSIBILITY[role] : null

  const canReleaseInventory = fallback?.canReleaseInventory ?? false
  const canReceiveInventory = fallback?.canReceiveInventory ?? false
  const canAdjustInventory = fallback?.canAdjustInventory ?? false

  return {
    canReleaseInventory,
    canReceiveInventory,
    canAdjustInventory,
    isWarehouseResponsible:
      canReleaseInventory || canReceiveInventory || canAdjustInventory,
    source: fallback ? 'legacy_role_fallback' : 'none',
  }
}

function hasExplicitAssignmentValue(value: boolean | null | undefined): value is boolean {
  return value !== null && value !== undefined
}

export function resolveWarehouseResponsibility(
  input: WarehouseResponsibilityInput | null | undefined
): WarehouseResponsibility {
  const fallback = resolveLegacyWarehouseFallback(input?.role)

  const canReleaseInventory = input?.canReleaseInventory ?? fallback.canReleaseInventory
  const canReceiveInventory = input?.canReceiveInventory ?? fallback.canReceiveInventory
  const canAdjustInventory = input?.canAdjustInventory ?? fallback.canAdjustInventory

  return {
    canReleaseInventory,
    canReceiveInventory,
    canAdjustInventory,
    isWarehouseResponsible:
      canReleaseInventory || canReceiveInventory || canAdjustInventory,
    source:
      hasExplicitAssignmentValue(input?.canReleaseInventory) ||
      hasExplicitAssignmentValue(input?.canReceiveInventory) ||
      hasExplicitAssignmentValue(input?.canAdjustInventory)
        ? 'explicit_assignment'
        : fallback.source,
  }
}

export function canReleaseInventory(
  input: WarehouseResponsibilityInput | null | undefined
): boolean {
  return resolveWarehouseResponsibility(input).canReleaseInventory
}

export function canReceiveInventory(
  input: WarehouseResponsibilityInput | null | undefined
): boolean {
  return resolveWarehouseResponsibility(input).canReceiveInventory
}

export function canAdjustInventory(
  input: WarehouseResponsibilityInput | null | undefined
): boolean {
  return resolveWarehouseResponsibility(input).canAdjustInventory
}

export function isWarehouseResponsible(
  input: WarehouseResponsibilityInput | null | undefined
): boolean {
  return resolveWarehouseResponsibility(input).isWarehouseResponsible
}
