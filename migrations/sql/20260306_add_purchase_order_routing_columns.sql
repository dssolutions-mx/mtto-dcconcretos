BEGIN;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS work_order_type text,
  ADD COLUMN IF NOT EXISTS approval_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS approval_amount_source text,
  ADD COLUMN IF NOT EXISTS payment_condition text,
  ADD COLUMN IF NOT EXISTS viability_state text;

COMMENT ON COLUMN public.purchase_orders.work_order_type IS
  'Normalized preventive/corrective indicator for PO routing.';

COMMENT ON COLUMN public.purchase_orders.approval_amount IS
  'Canonical amount used for approval routing without repurposing total_amount.';

COMMENT ON COLUMN public.purchase_orders.approval_amount_source IS
  'Source used to compute approval_amount (request_total, items_total, purchase_items_total, selected_quotation).';

COMMENT ON COLUMN public.purchase_orders.payment_condition IS
  'Normalized payment condition used for viability review (cash or credit).';

COMMENT ON COLUMN public.purchase_orders.viability_state IS
  'Application-level viability state for future workflow steps.';

COMMIT;
