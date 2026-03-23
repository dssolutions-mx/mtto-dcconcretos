-- =====================================================
-- Add Feature Flag for Compliance System Visibility
-- Migration: 20260213_add_compliance_feature_flag
-- Description: Add enable_compliance_system to hide Cumplimiento section until announced
-- Default: DISABLED (false) - can be enabled via System Settings / Organización
-- =====================================================

INSERT INTO system_settings (key, value, description) VALUES
  ('enable_compliance_system', '"false"'::jsonb, 'Show Cumplimiento section in navigation (false = hidden, true = visible). Change via /compliance/configuracion')
ON CONFLICT (key) DO NOTHING;
