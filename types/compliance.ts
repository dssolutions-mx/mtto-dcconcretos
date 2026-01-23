// Compliance & Governance System Types

export interface SystemSetting {
  id: string
  key: string
  value: boolean | number | string | Record<string, unknown>
  description: string | null
  updated_by: string | null
  updated_at: string
  created_at: string
}

export interface Policy {
  id: string
  code: string
  title: string
  description: string | null
  document_url: string | null
  version: string
  is_active: boolean
  effective_date: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PolicyRule {
  id: string
  policy_id: string
  rule_number: string
  title: string
  description: string
  rule_type: 'checklist_requirement' | 'operator_assignment' | 'maintenance_schedule' | 'safety_protocol' | 'other'
  severity: 'low' | 'medium' | 'high' | 'critical'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PolicyAcknowledgment {
  id: string
  user_id: string
  policy_id: string
  acknowledged_at: string
  ip_address: string | null
  user_agent: string | null
  signature_data: string | null
  comprehension_score: number | null
  created_at: string
}

export interface AssetAccountabilityTracking {
  id: string
  asset_id: string
  has_operator: boolean
  has_recent_checklist: boolean
  has_pending_schedules: boolean
  primary_responsible_user_id: string | null
  secondary_responsible_user_id: string | null
  alert_level: 'ok' | 'warning' | 'critical' | 'emergency'
  days_without_checklist: number
  days_without_operator: number
  last_checklist_date: string | null
  last_checklist_id: string | null
  oldest_pending_schedule_date: string | null
  pending_schedules_count: number
  last_notified_at: string | null
  last_escalated_at: string | null
  notification_count: number
  escalation_count: number
  last_updated_at: string
  created_at: string
}

export interface ComplianceIncident {
  id: string
  user_id: string
  policy_id: string | null
  policy_rule_id: string | null
  incident_type: 'orphan_asset' | 'overdue_checklist' | 'missing_operator' | 'manual_report' | 'other'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending_review' | 'dismissed' | 'confirmed' | 'resolved'
  source: 'system_detected' | 'manual_report'
  reported_by: string | null
  asset_id: string | null
  checklist_schedule_id: string | null
  evidence_description: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolution_notes: string | null
  dispute_reason: string | null
  dispute_status: 'none' | 'pending' | 'under_review' | 'approved' | 'rejected'
  dispute_submitted_at: string | null
  dispute_reviewed_by: string | null
  dispute_reviewed_at: string | null
  dispute_review_notes: string | null
  incident_date: string
  created_at: string
  updated_at: string
}

export interface ComplianceDisputeHistory {
  id: string
  incident_id: string
  action: 'submitted' | 'review_started' | 'approved' | 'rejected' | 'withdrawn'
  performed_by: string
  notes: string | null
  created_at: string
  performed_by_profile?: {
    id: string
    nombre: string
    apellido: string
    role: string
  }
}

export interface Sanction {
  id: string
  incident_id: string | null
  user_id: string
  policy_rule_id: string | null
  sanction_type: 'verbal_warning' | 'written_warning' | 'suspension' | 'fine' | 'termination' | 'other'
  description: string
  sanction_amount: number | null
  percentage: number | null
  applied_date: string
  applied_by: string
  status: 'active' | 'resolved' | 'cancelled'
  resolved_at: string | null
  resolved_by: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
}

export interface ComplianceNotification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'forgotten_asset' | 'overdue_checklist' | 'asset_moved_orphaned' | 'asset_operator_removed' | 'compliance_warning' | 'compliance_critical' | 'compliance_emergency' | 'sanction_applied' | 'policy_update'
  priority: 'low' | 'medium' | 'high' | 'critical'
  entity_id: string | null
  entity_type: string | null
  is_read: boolean
  read_at: string | null
  is_dismissed: boolean
  dismissed_at: string | null
  action_url: string | null
  action_label: string | null
  created_at: string
  expires_at: string | null
}

// Extended types with related data
export interface ForgottenAsset extends AssetAccountabilityTracking {
  asset_name: string
  asset_code: string
  plant_name: string | null
  business_unit_name: string | null
  operator_name: string | null
  primary_responsible_name: string | null
}

export interface ComplianceIncidentWithDetails extends ComplianceIncident {
  user_name: string | null
  asset_name: string | null
  asset_code: string | null
  policy_title: string | null
  policy_rule_title: string | null
}

export interface SanctionWithDetails extends Sanction {
  user_name: string | null
  applied_by_name: string | null
  incident_description: string | null
  policy_rule_title: string | null
}

// API Request/Response Types
export interface AcknowledgePolicyRequest {
  policy_id: string
  signature_data?: string
  comprehension_score?: number
}

export interface CreateComplianceIncidentRequest {
  user_id: string
  incident_type: ComplianceIncident['incident_type']
  severity: ComplianceIncident['severity']
  asset_id?: string
  checklist_schedule_id?: string
  evidence_description?: string
  policy_rule_id?: string
}

export interface DisputeIncidentRequest {
  incident_id: string
  dispute_reason: string
}

export interface ApplySanctionRequest {
  incident_id?: string
  user_id: string
  sanction_type: Sanction['sanction_type']
  description: string
  sanction_amount?: number
  percentage?: number
  policy_rule_id?: string
}

export interface UpdateSystemSettingRequest {
  key: string
  value: boolean | number | string | Record<string, unknown>
  description?: string
}

// Compliance Status Types
export interface ComplianceStatus {
  status: 'ok' | 'warning' | 'critical' | 'emergency'
  message: string
  days_overdue: number
  active_sanctions_count: number
  pending_incidents_count: number
  unread_notifications_count: number
}

export interface ComplianceDashboardStats {
  total_assets: number
  compliant_assets: number
  warning_assets: number
  critical_assets: number
  emergency_assets: number
  assets_without_operator: number
  compliance_rate: number
  average_days_overdue: number
}
