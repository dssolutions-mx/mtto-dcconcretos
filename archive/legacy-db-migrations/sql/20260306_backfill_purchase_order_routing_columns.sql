BEGIN;

-- Historical-only transition pass.
-- Leave all quote-required rows untouched unless a future migration can
-- reconstruct their canonical selected quotation safely.
UPDATE public.purchase_orders po
SET work_order_type = wo.type
FROM public.work_orders wo
WHERE po.work_order_id = wo.id
  AND po.work_order_type IS NULL
  AND wo.type IS NOT NULL
  AND requires_quotation(po.po_type, po.total_amount, po.po_purpose) = false;

UPDATE public.purchase_orders
SET approval_amount = total_amount
WHERE approval_amount IS NULL
  AND total_amount IS NOT NULL
  AND requires_quotation(po_type, total_amount, po_purpose) = false;

UPDATE public.purchase_orders
SET approval_amount_source = 'request_total'
WHERE approval_amount_source IS NULL
  AND approval_amount IS NOT NULL
  AND requires_quotation(po_type, total_amount, po_purpose) = false;

UPDATE public.purchase_orders
SET payment_condition = CASE
  WHEN payment_method = 'transfer' THEN 'credit'
  WHEN payment_method IN ('cash', 'card') THEN 'cash'
  ELSE payment_condition
END
WHERE payment_condition IS NULL
  AND requires_quotation(po_type, total_amount, po_purpose) = false;

UPDATE public.purchase_orders
SET viability_state = CASE
  WHEN po_purpose = 'work_order_inventory' THEN 'not_required'
  ELSE 'pending'
END
WHERE viability_state IS NULL
  AND requires_quotation(po_type, total_amount, po_purpose) = false;

COMMIT;
