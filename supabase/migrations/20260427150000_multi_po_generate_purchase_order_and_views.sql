-- Multi-PO per work order: legacy RPC + views aligned with purchase_orders.work_order_id.
-- generate_purchase_order: only set work_orders.purchase_order_id / procurement fields on first OC.
-- Optional trigger: typed inserts that set work_order_id also backfill canonical pointer when null.
-- Views: purchase_order_status / purchase_order_number from latest updated_at (tie-break created_at).

CREATE OR REPLACE FUNCTION public.generate_purchase_order(
  p_work_order_id uuid,
  p_supplier text,
  p_items jsonb,
  p_requested_by uuid,
  p_expected_delivery_date timestamp with time zone,
  p_quotation_url text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order_counter INT;
  v_order_id TEXT;
  v_po_id UUID;
  v_total_amount DECIMAL(10,2) := 0;
BEGIN
  SELECT COUNT(*) + 1 INTO v_order_counter FROM purchase_orders;

  v_order_id := 'OC-' || LPAD(v_order_counter::TEXT, 4, '0');

  SELECT COALESCE(SUM((item->>'total_price')::DECIMAL), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(p_items) AS item;

  INSERT INTO purchase_orders (
    order_id,
    work_order_id,
    supplier,
    items,
    total_amount,
    status,
    requested_by,
    expected_delivery_date,
    quotation_url
  ) VALUES (
    v_order_id,
    p_work_order_id,
    p_supplier,
    p_items,
    v_total_amount,
    'Pendiente',
    p_requested_by,
    p_expected_delivery_date,
    p_quotation_url
  ) RETURNING id INTO v_po_id;

  -- First OC only: do not overwrite canonical PO or regress status/cost on additional OCs.
  UPDATE work_orders
  SET
    purchase_order_id = COALESCE(purchase_order_id, v_po_id),
    status = CASE
      WHEN purchase_order_id IS NULL THEN 'En cotización'::text
      ELSE status
    END,
    estimated_cost = CASE
      WHEN purchase_order_id IS NULL THEN v_total_amount
      ELSE estimated_cost
    END,
    updated_at = NOW()
  WHERE id = p_work_order_id;

  RETURN v_po_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_work_order_canonical_purchase_order_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.work_order_id IS NOT NULL THEN
    UPDATE work_orders w
    SET
      purchase_order_id = COALESCE(w.purchase_order_id, NEW.id),
      updated_at = NOW()
    WHERE w.id = NEW.work_order_id
      AND w.purchase_order_id IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_purchase_orders_sync_wo_canonical_po ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_sync_wo_canonical_po
AFTER INSERT ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_work_order_canonical_purchase_order_id();

CREATE OR REPLACE VIEW public.work_orders_with_checklist_status AS
SELECT wo.id,
    wo.order_id,
    wo.asset_id,
    wo.description,
    wo.type,
    wo.requested_by,
    wo.assigned_to,
    wo.planned_date,
    wo.estimated_duration,
    wo.priority,
    wo.status,
    wo.required_parts,
    wo.estimated_cost,
    wo.checklist_id,
    wo.maintenance_plan_id,
    wo.issue_items,
    wo.purchase_order_id,
    wo.approval_status,
    wo.approved_by,
    wo.approval_date,
    wo.created_at,
    wo.updated_at,
    wo.completed_at,
    wo.used_parts,
    wo.service_order_id,
    wo.updated_by,
    wo.creation_photos,
    wo.completion_photos,
    wo.progress_photos,
    wo.incident_id,
    wo.preventive_checklist_id,
    wo.preventive_checklist_completed,
    CASE
        WHEN wo.type = 'preventive'::text AND wo.preventive_checklist_id IS NOT NULL THEN
        CASE
            WHEN wo.preventive_checklist_completed THEN 'Completado'::text
            WHEN (EXISTS (
              SELECT 1
              FROM maintenance_checklists mc
              WHERE mc.work_order_id = wo.id AND mc.status = 'completed'::text
            )) THEN 'Completado'::text
            ELSE 'Pendiente'::text
        END
        ELSE 'No requerido'::text
    END AS checklist_status,
    (
      SELECT po.status
      FROM purchase_orders po
      WHERE po.work_order_id = wo.id
      ORDER BY po.updated_at DESC NULLS LAST, po.created_at DESC NULLS LAST
      LIMIT 1
    ) AS purchase_order_status,
    public.is_work_order_ready_to_execute(wo.id) AS ready_to_execute
FROM work_orders wo;

CREATE OR REPLACE VIEW public.pending_expense_approvals AS
SELECT ae.id,
    ae.work_order_id,
    wo.order_id AS work_order_number,
    ae.asset_id,
    a.name AS asset_name,
    ae.description,
    ae.amount,
    ae.justification,
    ae.status,
    ae.created_at,
    (p.nombre || ' '::text) || p.apellido AS requested_by,
    wo.purchase_order_id,
    (
      SELECT po.order_id
      FROM purchase_orders po
      WHERE po.work_order_id = wo.id
      ORDER BY po.updated_at DESC NULLS LAST, po.created_at DESC NULLS LAST
      LIMIT 1
    ) AS purchase_order_number
FROM additional_expenses ae
JOIN work_orders wo ON ae.work_order_id = wo.id
JOIN assets a ON ae.asset_id = a.id
JOIN profiles p ON ae.created_by = p.id
WHERE ae.status = 'pendiente_aprobacion'::text;

COMMENT ON VIEW public.work_orders_with_checklist_status IS
  'purchase_order_status: status of linked PO with max(updated_at), tie-break max(created_at), for purchase_orders.work_order_id = wo.id.';

COMMENT ON VIEW public.pending_expense_approvals IS
  'purchase_order_number: order_id of same latest-linked-PO rule as work_orders_with_checklist_status.';
