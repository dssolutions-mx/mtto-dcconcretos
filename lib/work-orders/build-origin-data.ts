import { format } from "date-fns"
import { es } from "date-fns/locale"
import { MaintenanceType } from "@/types"

export type OriginType = "incident" | "checklist" | "preventive" | "adhoc"

export interface WorkOrderOriginData {
  /** Badge: Desde incidente | Desde checklist | Preventivo programado | Manual / Ad-hoc */
  originType: OriginType
  /** Checklist name (corrective) or plan name (preventive) */
  originName: string | null
  /** Fecha reporte (corrective) or próximo ciclo (preventive) */
  fechaLabel: string
  fechaValue: string | null
  /** Main asset identifier (asset_id is the primary ID in the business) */
  assetIdentifier: string | null
  assetId: string | null
  location: string | null
  /** Ciclo N, Intervalo Xh (preventive only) */
  cycleInterval: string | null
}

/** Build origin data from work order and fetched relations. Server-safe utility. */
export function buildOriginData(params: {
  workOrder: {
    checklist_id?: string | null
    maintenance_plan_id?: string | null
    incident_id?: string | null
    created_at?: string | null
    planned_date?: string | null
    type?: string | null
    asset?: { id?: string; name?: string | null; asset_id?: string | null; location?: string | null } | null
  }
  checklistName: string | null
  maintenancePlanName: string | null
  maintenancePlanNextDue: string | null
  maintenancePlanInterval: string | null
  firstIssueDate: string | null
}): WorkOrderOriginData {
  const {
    workOrder,
    checklistName,
    maintenancePlanName,
    maintenancePlanNextDue,
    maintenancePlanInterval,
    firstIssueDate,
  } = params

  const isPreventive =
    workOrder.type === MaintenanceType.Preventive ||
    workOrder.type === "Preventivo" ||
    workOrder.type === "preventive"

  let originType: OriginType = "adhoc"
  let originName: string | null = null
  let fechaLabel = "Fecha de creación"
  let fechaValue: string | null = workOrder.created_at
    ? format(new Date(workOrder.created_at), "PPP", { locale: es })
    : null
  let cycleInterval: string | null = null

  if (workOrder.incident_id) {
    originType = "incident"
    originName = null
    fechaLabel = "Fecha reporte"
    fechaValue = firstIssueDate ? format(new Date(firstIssueDate), "PPP", { locale: es }) : fechaValue
  } else if (workOrder.checklist_id && !isPreventive) {
    originType = "checklist"
    originName = checklistName
    fechaLabel = "Fecha reporte"
    fechaValue = firstIssueDate ? format(new Date(firstIssueDate), "PPP", { locale: es }) : fechaValue
  } else if (workOrder.maintenance_plan_id && isPreventive) {
    originType = "preventive"
    originName = maintenancePlanName
    fechaLabel = "Próximo ciclo"
    fechaValue = maintenancePlanNextDue
      ? format(new Date(maintenancePlanNextDue), "PPP", { locale: es })
      : workOrder.planned_date
        ? format(new Date(workOrder.planned_date), "PPP", { locale: es })
        : "No planificada"
    cycleInterval = maintenancePlanInterval
  }

  return {
    originType,
    originName,
    fechaLabel,
    fechaValue,
    assetIdentifier: workOrder.asset?.asset_id ?? null,
    assetId: workOrder.asset?.id ?? null,
    location: workOrder.asset?.location ?? null,
    cycleInterval,
  }
}
