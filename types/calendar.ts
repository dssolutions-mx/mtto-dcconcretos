/** Maintenance status for calendar/planning views */
export type MaintenanceStatus = 'overdue' | 'upcoming' | 'covered' | 'scheduled'

/** Urgency level (cross-cutting metric) */
export type MaintenanceUrgency = 'low' | 'medium' | 'high'

/** Status filter for calendar - urgency is cross-cutting */
export type StatusFilter =
  | null // "Todos"
  | MaintenanceStatus
  | 'urgent' // urgency === 'high'

export interface UpcomingMaintenance {
  id: string
  assetId: string
  assetName: string
  assetCode: string
  intervalId: string
  intervalName: string
  intervalType: string
  targetValue: number
  currentValue: number
  valueRemaining: number
  unit: string
  estimatedDate: string
  status: MaintenanceStatus
  urgency: MaintenanceUrgency
  lastMaintenance?: {
    date: string
    value: number
  }
}

export interface MaintenanceSummary {
  overdue: number
  upcoming: number
  covered: number
  scheduled: number
  highUrgency: number
  mediumUrgency: number
}

export interface CalendarFilters {
  status: StatusFilter
  sortBy: 'default' | 'urgency' | 'date' | 'asset'
  month?: string // YYYY-MM
}

export interface WarrantyEvent {
  id: string
  assetId: string
  assetName: string
  assetCode: string
  warrantyExpiration: string // ISO date
  status: 'expired' | 'expiring_soon' | 'active'
}

/** Work order with planned_date — actual scheduled work (most actionable) */
export interface WorkOrderEvent {
  id: string
  orderId: string
  assetId: string | null
  assetName: string | null
  assetCode: string | null
  plannedDate: string // ISO
  type: string
  priority: string
  status: string
  description: string | null
}
