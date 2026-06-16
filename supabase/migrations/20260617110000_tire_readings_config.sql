-- Sprint 5: configurable tire readings section in checklist templates

ALTER TABLE public.checklist_sections
  ADD COLUMN IF NOT EXISTS tire_readings_config jsonb;

COMMENT ON COLUMN public.checklist_sections.tire_readings_config IS
  'Config for tire_readings sections: reading_mode (psi|mm|both|none), measure_tread, measure_pressure, require_all_positions.';
