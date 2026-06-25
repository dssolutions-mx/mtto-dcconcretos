export type BonusTrafficLight = 'green' | 'yellow' | 'red' | 'gray'

export type BonusSystemRecommendation = 'eligible' | 'ineligible' | 'pending'

export type BonusPaySheetRow = {
  operator_id: string
  operator_name: string
  employee_code: string | null
  plant_id: string
  plant_name: string
  punctuality_pct: number | null
  cleanliness_pass_rate: number | null
  closure_official: boolean | null
  system_recommendation: BonusSystemRecommendation
  traffic_light: BonusTrafficLight
  punctuality_days_total: number
  punctuality_days_on_time: number
  cleanliness_evals_total: number
  cleanliness_evals_passed: number
}

export type BonusDecisionSummaryPayload = {
  year: number
  month: number
  plant_id: string | null
  business_unit_id: string | null
  rows: BonusPaySheetRow[]
  summary: {
    total_operators: number
    closure_completed: number
    closure_eligible: number
    avg_punctuality_pct: number | null
    avg_cleanliness_pass_rate: number | null
  }
}

export type PunctualityDayReport = {
  event_date: string
  status: string
  reason: string | null
  source_completion_id: string | null
}

export type PunctualityOperatorReport = {
  operator_id: string
  operator_name: string
  employee_code: string | null
  plant_id: string
  plant_name: string
  punctuality_pct: number
  days_total: number
  days_on_time: number
  days_late: number
  days_absent: number
  days: PunctualityDayReport[]
}

export type PunctualityReportsPayload = {
  year: number
  month: number
  operators: PunctualityOperatorReport[]
}

export type SecurityTalkReport = {
  id: string
  operator_id: string
  operator_name: string
  employee_code: string | null
  plant_id: string
  plant_name: string
  event_date: string
  topic: string | null
  reflection?: string | null
  evidence: unknown
  source_completion_id?: string
}

export type SecurityTalkSessionAttendee = {
  operator_id: string
  operator_name: string
  employee_code: string | null
}

export type SecurityTalkSessionReport = {
  source_completion_id: string
  event_date: string
  plant_id: string
  plant_name: string
  topic: string | null
  reflection: string | null
  evidence: unknown
  attendees: SecurityTalkSessionAttendee[]
  attendee_count: number
}

export type SecurityTalkOperatorAttendanceReport = {
  operator_id: string
  operator_name: string
  employee_code: string | null
  plant_id: string
  plant_name: string
  production_days: number
  talks_attended: number
  gap_days: number
  attended_dates: string[]
  missed_dates: string[]
}

export type SecurityTalkReportsSummary = {
  talks_logged: number
  unique_production_days_with_talk: number
  attendance_rate_pct: number | null
  operators_with_gaps: number
  total_production_days: number
}

export type SecurityTalkReportsPayload = {
  year: number
  month: number
  talks: SecurityTalkReport[]
  sessions?: SecurityTalkSessionReport[]
  operators?: SecurityTalkOperatorAttendanceReport[]
  summary?: SecurityTalkReportsSummary
}

export type DosificadorComplianceDay = {
  dayKey: string
  had_production: boolean
  control_registered: boolean
  punctuality_registered: boolean
}

export type DosificadorPlantClosure = {
  plant_id: string
  plant_name: string
  closure_completed: boolean
  closure_eligible_count: number
  closure_total: number
}

export type OperatorBonusDetailEvent = {
  id: string
  event_type: string
  event_date: string
  status: string
  reason: string | null
  evidence: unknown
  metadata: unknown
}
