/** Roles that plan or oversee the maintenance agenda (coordinators, managers). */
export const AGENDA_PLANNING_ROLES = [
  "GERENCIA_GENERAL",
  "GERENTE_MANTENIMIENTO",
  "JEFE_UNIDAD_NEGOCIO",
  "JEFE_PLANTA",
  "COORDINADOR_MANTENIMIENTO",
  "ENCARGADO_MANTENIMIENTO",
] as const

/** Roles that consume agenda APIs for field execution. */
export const AGENDA_MECHANIC_ROLES = ["MECANICO"] as const

export const AGENDA_INTEGRATION_ROLES = [
  ...AGENDA_PLANNING_ROLES,
  ...AGENDA_MECHANIC_ROLES,
] as const

export function isAgendaPlanningRole(role: string): boolean {
  return (AGENDA_PLANNING_ROLES as readonly string[]).includes(role)
}

export function canAccessAgendaIntegrations(role: string): boolean {
  return (AGENDA_INTEGRATION_ROLES as readonly string[]).includes(role)
}

export function canQuickUpdateWorkOrderStatus(
  role: string,
  userId: string,
  assignedTo: string | null,
): boolean {
  if (isAgendaPlanningRole(role)) return true
  if (role === "MECANICO") return assignedTo === userId
  return false
}

export function canViewCotizadorPlantMapping(role: string): boolean {
  return role === "GERENCIA_GENERAL"
}
