/**
 * Normalize maintenance_history.type for UI bucketing.
 * Work orders store English "preventive"; manual forms often use Spanish "Preventivo"/"preventivo".
 */
export function isPreventiveMaintenanceType(type: string | null | undefined): boolean {
  const t = (type ?? "").trim().toLowerCase();
  return t === "preventive" || t === "preventivo";
}

export function isInspectionMaintenanceType(type: string | null | undefined): boolean {
  const t = (type ?? "").trim().toLowerCase();
  return t === "inspección" || t === "inspeccion" || t === "inspection";
}
