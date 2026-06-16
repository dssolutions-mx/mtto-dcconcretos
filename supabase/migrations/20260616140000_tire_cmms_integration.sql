-- Tire module CMMS integration: Phases A (WO), B (PO), C (inventory), D (checklist).

-- ---------------------------------------------------------------------------
-- Phase A: work order anchor
-- ---------------------------------------------------------------------------
ALTER TABLE public.asset_tire_installations
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL;

ALTER TABLE public.tire_events
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_asset_tire_installations_work_order
  ON public.asset_tire_installations (work_order_id)
  WHERE work_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tire_events_work_order
  ON public.tire_events (work_order_id)
  WHERE work_order_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Phase B: procurement bridge
-- ---------------------------------------------------------------------------
ALTER TABLE public.tires
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS po_line_index integer;

CREATE INDEX IF NOT EXISTS idx_tires_purchase_order ON public.tires (purchase_order_id);

-- ---------------------------------------------------------------------------
-- Phase C: inventory reconciliation
-- ---------------------------------------------------------------------------
ALTER TABLE public.tires
  ADD COLUMN IF NOT EXISTS inventory_part_id uuid REFERENCES public.inventory_parts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.inventory_warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plant_id uuid REFERENCES public.plants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tires_inventory_part ON public.tires (inventory_part_id);
CREATE INDEX IF NOT EXISTS idx_tires_warehouse ON public.tires (warehouse_id);

-- ---------------------------------------------------------------------------
-- Phase D: checklist tire_readings section
-- ---------------------------------------------------------------------------
ALTER TABLE public.tire_readings
  ADD COLUMN IF NOT EXISTS checklist_id uuid REFERENCES public.completed_checklists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_code text;

CREATE INDEX IF NOT EXISTS idx_tire_readings_checklist
  ON public.tire_readings (checklist_id)
  WHERE checklist_id IS NOT NULL;

ALTER TABLE public.completed_checklists
  ADD COLUMN IF NOT EXISTS tire_readings_snapshot jsonb;

COMMENT ON COLUMN public.completed_checklists.tire_readings_snapshot IS
  'Snapshot of tire tread/pressure readings captured during checklist execution.';

-- Extend checklist section types (drop/recreate named constraint if present)
ALTER TABLE public.checklist_sections
  DROP CONSTRAINT IF EXISTS checklist_sections_section_type_check;

ALTER TABLE public.checklist_sections
  ADD CONSTRAINT checklist_sections_section_type_check
  CHECK (section_type = ANY (ARRAY[
    'checklist'::text,
    'evidence'::text,
    'cleanliness_bonus'::text,
    'security_talk'::text,
    'tire_readings'::text
  ]));

COMMENT ON COLUMN public.checklist_sections.section_type IS
  'Section type: checklist, evidence, cleanliness_bonus, security_talk, tire_readings.';
