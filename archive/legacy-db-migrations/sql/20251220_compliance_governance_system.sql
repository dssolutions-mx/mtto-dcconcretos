-- =====================================================
-- Compliance & Governance System
-- Migration: 20251220_compliance_governance_system
-- Description: Complete compliance tracking, asset accountability, policies, and sanctions system
-- =====================================================

-- =====================================================
-- 1. SYSTEM SETTINGS TABLE (Feature Toggles)
-- =====================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE system_settings IS 'Global system configuration and feature toggles';
COMMENT ON COLUMN system_settings.key IS 'Setting key (e.g., enforce_asset_blocking)';
COMMENT ON COLUMN system_settings.value IS 'JSONB value (can be boolean, number, string, or object)';

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES
  ('enforce_asset_blocking', '"false"'::jsonb, 'Enable hard blocking of operations without compliance (false = warning only, true = block)'),
  ('compliance_warning_threshold_days', '"7"'::jsonb, 'Days without checklist before warning'),
  ('compliance_critical_threshold_days', '"14"'::jsonb, 'Days without checklist before critical'),
  ('compliance_emergency_threshold_days', '"30"'::jsonb, 'Days without checklist before emergency'),
  ('asset_grace_period_days', '"7"'::jsonb, 'Days new assets are excluded from compliance checks')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- =====================================================
-- 2. POLICIES TABLE (Document Storage)
-- =====================================================
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- e.g., 'POL-OPE-001'
  title TEXT NOT NULL,
  description TEXT,
  document_url TEXT, -- Path to PDF file
  version TEXT DEFAULT '1.0',
  is_active BOOLEAN DEFAULT true,
  effective_date DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE policies IS 'Company policies and regulations';
COMMENT ON COLUMN policies.code IS 'Policy code identifier (e.g., POL-OPE-001)';
COMMENT ON COLUMN policies.document_url IS 'URL or path to policy PDF document';

CREATE INDEX IF NOT EXISTS idx_policies_code ON policies(code);
CREATE INDEX IF NOT EXISTS idx_policies_active ON policies(is_active) WHERE is_active = true;

-- =====================================================
-- 3. POLICY RULES TABLE (Actionable Clauses)
-- =====================================================
CREATE TABLE IF NOT EXISTS policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  rule_number TEXT NOT NULL, -- e.g., '3.6', '3.1'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('checklist_requirement', 'operator_assignment', 'maintenance_schedule', 'safety_protocol', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(policy_id, rule_number)
);

COMMENT ON TABLE policy_rules IS 'Specific enforceable clauses extracted from policies';
COMMENT ON COLUMN policy_rules.rule_number IS 'Rule reference number within the policy (e.g., 3.6)';
COMMENT ON COLUMN policy_rules.rule_type IS 'Type of rule for categorization and enforcement';

CREATE INDEX IF NOT EXISTS idx_policy_rules_policy_id ON policy_rules(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_rules_active ON policy_rules(is_active) WHERE is_active = true;

-- =====================================================
-- 4. POLICY ACKNOWLEDGMENTS TABLE (User Acceptance Tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS policy_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_address INET,
  user_agent TEXT,
  signature_data TEXT, -- Optional digital signature
  comprehension_score INTEGER CHECK (comprehension_score >= 0 AND comprehension_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, policy_id)
);

COMMENT ON TABLE policy_acknowledgments IS 'Track which users have read and accepted policies';
COMMENT ON COLUMN policy_acknowledgments.comprehension_score IS 'Optional quiz score (0-100)';

CREATE INDEX IF NOT EXISTS idx_policy_acknowledgments_user_id ON policy_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_acknowledgments_policy_id ON policy_acknowledgments(policy_id);

-- =====================================================
-- 5. ASSET ACCOUNTABILITY TRACKING TABLE (Health Record)
-- =====================================================
CREATE TABLE IF NOT EXISTS asset_accountability_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  
  -- Current state
  has_operator BOOLEAN DEFAULT false,
  has_recent_checklist BOOLEAN DEFAULT false, -- Within last 7 days
  has_pending_schedules BOOLEAN DEFAULT false,
  
  -- Responsibility chain
  primary_responsible_user_id UUID REFERENCES profiles(id), -- Operator if assigned, else Jefe Planta
  secondary_responsible_user_id UUID REFERENCES profiles(id), -- Jefe Planta or Jefe Unidad
  
  -- Alert status
  alert_level TEXT DEFAULT 'ok' CHECK (alert_level IN ('ok', 'warning', 'critical', 'emergency')),
  days_without_checklist INTEGER DEFAULT 0,
  days_without_operator INTEGER DEFAULT 0,
  
  -- Last checklist info
  last_checklist_date TIMESTAMPTZ,
  last_checklist_id UUID REFERENCES completed_checklists(id),
  
  -- Pending schedules info
  oldest_pending_schedule_date TIMESTAMPTZ,
  pending_schedules_count INTEGER DEFAULT 0,
  
  -- Last actions
  last_notified_at TIMESTAMPTZ,
  last_escalated_at TIMESTAMPTZ,
  notification_count INTEGER DEFAULT 0,
  escalation_count INTEGER DEFAULT 0,
  
  -- Metadata
  last_updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT unique_asset_tracking UNIQUE (asset_id)
);

COMMENT ON TABLE asset_accountability_tracking IS 'Real-time health record for each asset - tracks compliance status and responsibility';
COMMENT ON COLUMN asset_accountability_tracking.alert_level IS 'ok, warning (7+ days), critical (14+ days), emergency (30+ days)';
COMMENT ON COLUMN asset_accountability_tracking.primary_responsible_user_id IS 'Operator if assigned, otherwise Plant Manager';

CREATE INDEX IF NOT EXISTS idx_asset_accountability_alerts ON asset_accountability_tracking(alert_level, last_notified_at)
  WHERE alert_level IN ('warning', 'critical', 'emergency');
CREATE INDEX IF NOT EXISTS idx_asset_accountability_asset_id ON asset_accountability_tracking(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_accountability_responsible ON asset_accountability_tracking(primary_responsible_user_id);

-- =====================================================
-- 6. COMPLIANCE INCIDENTS TABLE (Violation Records)
-- =====================================================
CREATE TABLE IF NOT EXISTS compliance_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id), -- Responsible user
  policy_id UUID REFERENCES policies(id),
  policy_rule_id UUID REFERENCES policy_rules(id),
  
  -- Incident details
  incident_type TEXT NOT NULL CHECK (incident_type IN ('orphan_asset', 'overdue_checklist', 'missing_operator', 'manual_report', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'dismissed', 'confirmed', 'resolved')),
  
  -- Source tracking
  source TEXT DEFAULT 'system_detected' CHECK (source IN ('system_detected', 'manual_report')),
  reported_by UUID REFERENCES profiles(id), -- Who reported (if manual)
  
  -- Evidence links
  asset_id UUID REFERENCES assets(id),
  checklist_schedule_id UUID REFERENCES checklist_schedules(id),
  evidence_description TEXT,
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution_notes TEXT,
  dispute_reason TEXT, -- If user disputes the incident
  
  -- Metadata
  incident_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE compliance_incidents IS 'Unified violation records from both orphaned assets and overdue checklists';
COMMENT ON COLUMN compliance_incidents.incident_type IS 'Type of compliance violation';
COMMENT ON COLUMN compliance_incidents.source IS 'How the incident was detected (system vs manual)';

CREATE INDEX IF NOT EXISTS idx_compliance_incidents_user_id ON compliance_incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_status ON compliance_incidents(status);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_asset_id ON compliance_incidents(asset_id);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_pending ON compliance_incidents(status, incident_date)
  WHERE status = 'pending_review';

-- =====================================================
-- 7. SANCTIONS TABLE (Formal Disciplinary Actions)
-- =====================================================
CREATE TABLE IF NOT EXISTS sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES compliance_incidents(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  policy_rule_id UUID REFERENCES policy_rules(id),
  
  -- Sanction details
  sanction_type TEXT NOT NULL CHECK (sanction_type IN ('verbal_warning', 'written_warning', 'suspension', 'fine', 'termination', 'other')),
  description TEXT NOT NULL,
  sanction_amount NUMERIC(10,2), -- For fines
  percentage NUMERIC(5,2), -- Percentage of daily wage (for payroll integration)
  
  -- Application
  applied_date DATE DEFAULT CURRENT_DATE NOT NULL,
  applied_by UUID NOT NULL REFERENCES profiles(id), -- Manager who applied sanction
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'cancelled')),
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE sanctions IS 'Formal disciplinary actions linked to policy violations';
COMMENT ON COLUMN sanctions.percentage IS 'Percentage of daily wage to deduct (for payroll integration)';

CREATE INDEX IF NOT EXISTS idx_sanctions_user_id ON sanctions(user_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_status ON sanctions(status);
CREATE INDEX IF NOT EXISTS idx_sanctions_incident_id ON sanctions(incident_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_active ON sanctions(status, applied_date)
  WHERE status = 'active';

-- =====================================================
-- 8. COMPLIANCE NOTIFICATIONS TABLE (Persistent Alerts)
-- =====================================================
CREATE TABLE IF NOT EXISTS compliance_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Notification details
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('forgotten_asset', 'overdue_checklist', 'asset_moved_orphaned', 'asset_operator_removed', 'compliance_warning', 'compliance_critical', 'compliance_emergency', 'sanction_applied', 'policy_update')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  -- Related entities
  entity_id UUID, -- Asset ID, Incident ID, etc.
  entity_type TEXT, -- 'asset', 'incident', 'sanction', 'policy'
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  
  -- Action links
  action_url TEXT, -- URL to resolve the notification
  action_label TEXT, -- e.g., 'Assign Operator', 'Complete Checklist'
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ -- Optional expiration
);

COMMENT ON TABLE compliance_notifications IS 'Persistent notification storage for compliance alerts (separate from general notifications)';
COMMENT ON COLUMN compliance_notifications.entity_type IS 'Type of related entity for linking';

CREATE INDEX IF NOT EXISTS idx_compliance_notifications_user_id ON compliance_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_notifications_unread ON compliance_notifications(user_id, is_read, created_at DESC)
  WHERE is_read = false AND is_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_compliance_notifications_type ON compliance_notifications(type, priority);

-- =====================================================
-- 9. TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policy_rules_updated_at BEFORE UPDATE ON policy_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_incidents_updated_at BEFORE UPDATE ON compliance_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sanctions_updated_at BEFORE UPDATE ON sanctions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_accountability_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 11. BASIC RLS POLICIES (Can be enhanced later)
-- =====================================================

-- System Settings: Only admins can view/edit
CREATE POLICY "Admins can manage system settings"
  ON system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA')
    )
  );

-- Policies: All authenticated users can view active policies
CREATE POLICY "Users can view active policies"
  ON policies FOR SELECT
  USING (is_active = true AND auth.role() = 'authenticated');

-- Policy Rules: All authenticated users can view active rules
CREATE POLICY "Users can view active policy rules"
  ON policy_rules FOR SELECT
  USING (is_active = true AND auth.role() = 'authenticated');

-- Policy Acknowledgments: Users can view their own
CREATE POLICY "Users can view own policy acknowledgments"
  ON policy_acknowledgments FOR SELECT
  USING (user_id = auth.uid());

-- Policy Acknowledgments: Users can create their own
CREATE POLICY "Users can acknowledge policies"
  ON policy_acknowledgments FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Asset Accountability: Users can view assets in their scope
CREATE POLICY "Users can view asset accountability in scope"
  ON asset_accountability_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assets a
      JOIN profiles p ON p.id = auth.uid()
      WHERE a.id = asset_accountability_tracking.asset_id
        AND (
          a.plant_id = p.plant_id
          OR p.role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO')
          OR (p.role = 'JEFE_UNIDAD_NEGOCIO' AND EXISTS (
            SELECT 1 FROM plants pl
            WHERE pl.id = a.plant_id AND pl.business_unit_id = p.business_unit_id
          ))
        )
    )
  );

-- Compliance Incidents: Users can view incidents related to them or their scope
CREATE POLICY "Users can view relevant compliance incidents"
  ON compliance_incidents FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'ENCARGADO_MANTENIMIENTO')
          OR (compliance_incidents.asset_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM assets a
            WHERE a.id = compliance_incidents.asset_id AND a.plant_id = p.plant_id
          ))
        )
    )
  );

-- Sanctions: Users can view their own sanctions
CREATE POLICY "Users can view own sanctions"
  ON sanctions FOR SELECT
  USING (user_id = auth.uid());

-- Sanctions: Managers can view sanctions in their scope
CREATE POLICY "Managers can view sanctions in scope"
  ON sanctions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'ENCARGADO_MANTENIMIENTO')
    )
  );

-- Compliance Notifications: Users can view their own notifications
CREATE POLICY "Users can view own compliance notifications"
  ON compliance_notifications FOR SELECT
  USING (user_id = auth.uid());

-- Compliance Notifications: Users can update their own notifications (mark as read/dismissed)
CREATE POLICY "Users can update own compliance notifications"
  ON compliance_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- Migration Complete
-- =====================================================
-- Summary:
-- ✅ system_settings: Feature toggles and configuration
-- ✅ policies: Policy documents (POL-OPE-001)
-- ✅ policy_rules: Actionable clauses from policies
-- ✅ policy_acknowledgments: User acceptance tracking
-- ✅ asset_accountability_tracking: Real-time asset health
-- ✅ compliance_incidents: Unified violation records
-- ✅ sanctions: Formal disciplinary actions
-- ✅ compliance_notifications: Persistent alert system
-- ✅ RLS policies: Basic security policies (can be enhanced)
