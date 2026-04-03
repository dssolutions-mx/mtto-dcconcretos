import type { OperatorPartsProcurement } from '@/lib/operator-incident-procurement'

export type { OperatorPartsProcurementStage } from '@/lib/operator-incident-procurement'

export type OperatorIncidentWorkOrder = {
  id: string
  order_id: string
  planned_date: string | null
  status: string | null
  priority: string | null
  mechanic_name: string | null
  created_at: string | null
  completed_at: string | null
  parts_procurement: OperatorPartsProcurement
} | null

export type OperatorIncidentItem = {
  id: string
  type: string
  description: string
  date: string
  status: string | null
  /** False when incident is resuelto/cerrado (operator list filter) */
  is_open: boolean
  documents: unknown
  reported_by: string | null
  reported_by_id: string | null
  created_at: string | null
  asset_uuid: string | null
  asset_code: string | null
  asset_name: string | null
  work_order: OperatorIncidentWorkOrder
}

export type OperatorIncidentsAssetGroup = {
  asset_uuid: string
  asset_id: string | null
  asset_name: string | null
  assignment_type: string
  open_incidents: number
  incidents: OperatorIncidentItem[]
}

export type OperatorIncidentsApiResponse = {
  assets: OperatorIncidentsAssetGroup[]
  summary: {
    total_open: number
    with_wo_pending: number
    with_wo_completed: number
    without_wo: number
  }
  operator: {
    id: string
    nombre: string | null
    apellido: string | null
    role: string
  }
}
