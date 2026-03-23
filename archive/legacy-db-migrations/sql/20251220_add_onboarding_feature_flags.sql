-- =====================================================
-- Add Feature Flags for Onboarding and Policy System
-- Migration: 20251220_add_onboarding_feature_flags
-- Description: Add feature toggles to control onboarding tour and policy acknowledgment
-- Default: Both features DISABLED (false) - can be enabled via System Settings page
-- =====================================================

-- Add feature flags for onboarding and policies
-- These are set to false by default so features are disabled until explicitly enabled
INSERT INTO system_settings (key, value, description) VALUES
  ('enable_onboarding_tour', '"false"'::jsonb, 'Enable automatic onboarding tour for new users (false = disabled, true = enabled). Change via /compliance/configuracion'),
  ('enable_policy_acknowledgment', '"false"'::jsonb, 'Enable policy acknowledgment modal on login (false = disabled, true = enabled). Change via /compliance/configuracion')
ON CONFLICT (key) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE system_settings IS 'Global system configuration and feature toggles. Use enable_onboarding_tour and enable_policy_acknowledgment to control new features.';
