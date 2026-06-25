/** Equipment model id for DC Concretos "PLANTA" (no horómetro/odómetro). */
export const PLANTA_MODEL_ID = '2c7bcf18-8a9c-4c9b-b85f-702ee0177896'

export const CHECKLIST_EXECUTOR_ROLE_OPTIONS = [
  'OPERADOR',
  'MECANICO',
  'DOSIFICADOR',
  'JEFE_PLANTA',
  'COORDINADOR_MANTENIMIENTO',
  'GERENTE_MANTENIMIENTO',
] as const

export type ChecklistExecutorRole = (typeof CHECKLIST_EXECUTOR_ROLE_OPTIONS)[number]

export const DEFAULT_EXECUTOR_ROLES: ChecklistExecutorRole[] = [
  ...CHECKLIST_EXECUTOR_ROLE_OPTIONS,
]

export const PLANT_EXECUTOR_ROLES: ChecklistExecutorRole[] = [
  'DOSIFICADOR',
  'JEFE_PLANTA',
]

export const EXECUTOR_ROLE_LABELS: Record<ChecklistExecutorRole, string> = {
  OPERADOR: 'Operador',
  MECANICO: 'Mecánico',
  DOSIFICADOR: 'Dosificador',
  JEFE_PLANTA: 'Jefe de Planta',
  COORDINADOR_MANTENIMIENTO: 'Coordinador de Mantenimiento',
  GERENTE_MANTENIMIENTO: 'Gerente de Mantenimiento',
}

export function isPlantaModelId(modelId: string | null | undefined): boolean {
  return modelId === PLANTA_MODEL_ID
}

export function isPlantaMaintenanceUnit(
  maintenanceUnit: string | null | undefined
): boolean {
  return (maintenanceUnit ?? '').toLowerCase() === 'none'
}

export function isPlantaAsset(input: {
  model_id?: string | null
  modelId?: string | null
  maintenance_unit?: string | null
  maintenanceUnit?: string | null
}): boolean {
  const modelId = input.model_id ?? input.modelId ?? null
  const maintenanceUnit =
    input.maintenance_unit ?? input.maintenanceUnit ?? null
  return isPlantaModelId(modelId) || isPlantaMaintenanceUnit(maintenanceUnit)
}

export function executorRolesForModel(
  modelId: string | null | undefined,
  maintenanceUnit?: string | null
): ChecklistExecutorRole[] {
  if (isPlantaAsset({ modelId, maintenanceUnit })) {
    return [...PLANT_EXECUTOR_ROLES]
  }
  return [...DEFAULT_EXECUTOR_ROLES]
}

export function normalizeExecutorRoles(
  roles: string[] | null | undefined
): ChecklistExecutorRole[] {
  if (!roles || roles.length === 0) {
    return [...DEFAULT_EXECUTOR_ROLES]
  }
  const filtered = roles.filter((r): r is ChecklistExecutorRole =>
    (CHECKLIST_EXECUTOR_ROLE_OPTIONS as readonly string[]).includes(r)
  )
  return filtered.length > 0 ? filtered : [...DEFAULT_EXECUTOR_ROLES]
}

export function roleInExecutorRoles(
  role: string,
  executorRoles: string[] | null | undefined
): boolean {
  return normalizeExecutorRoles(executorRoles).includes(role as ChecklistExecutorRole)
}
