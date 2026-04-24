-- select_quotation synced total_amount and items from the winning quote but left
-- approval_amount / approval_amount_source at create-time values (e.g. mixed OT routing),
-- causing UI/policy mismatch vs quoted_amount. Align approval with the selected quotation.

CREATE OR REPLACE FUNCTION public.select_quotation(
  p_quotation_id uuid,
  p_user_id uuid,
  p_selection_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_quotation RECORD;
  v_quotation_items JSONB;
  v_updated_items JSONB;
  v_item JSONB;
  v_quotation_item JSONB;
BEGIN
  SELECT * INTO v_quotation
  FROM purchase_order_quotations
  WHERE id = p_quotation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quotation not found');
  END IF;

  UPDATE purchase_order_quotations
  SET status = 'rejected',
      rejection_reason = 'Otra cotización fue seleccionada',
      updated_at = NOW()
  WHERE purchase_order_id = v_quotation.purchase_order_id
    AND id != p_quotation_id
    AND status = 'pending';

  UPDATE purchase_order_quotations
  SET status = 'selected',
      selected_at = NOW(),
      selected_by = p_user_id,
      selection_reason = p_selection_reason,
      updated_at = NOW()
  WHERE id = p_quotation_id;

  v_quotation_items := v_quotation.quotation_items;

  IF v_quotation_items IS NOT NULL AND jsonb_array_length(v_quotation_items) > 0 THEN
    v_updated_items := '[]'::jsonb;

    FOR v_quotation_item IN SELECT * FROM jsonb_array_elements(v_quotation_items)
    LOOP
      v_item := jsonb_build_object(
        'name', v_quotation_item->>'description',
        'partNumber', v_quotation_item->>'part_number',
        'quantity', (v_quotation_item->>'quantity')::numeric,
        'unit_price', (v_quotation_item->>'unit_price')::numeric,
        'total_price', (v_quotation_item->>'total_price')::numeric,
        'quoted_unit_price', (v_quotation_item->>'unit_price')::numeric,
        'brand', v_quotation_item->>'brand',
        'notes', v_quotation_item->>'notes'
      );

      IF v_quotation_item->>'part_id' IS NOT NULL THEN
        v_item := v_item || jsonb_build_object('part_id', v_quotation_item->>'part_id');
      END IF;

      v_updated_items := v_updated_items || jsonb_build_array(v_item);
    END LOOP;

    UPDATE purchase_orders
    SET items = v_updated_items,
        total_amount = v_quotation.quoted_amount,
        approval_amount = v_quotation.quoted_amount,
        approval_amount_source = 'selected_quotation',
        selected_quotation_id = p_quotation_id,
        supplier = v_quotation.supplier_name,
        supplier_id = v_quotation.supplier_id,
        status = 'pending_approval',
        updated_at = NOW()
    WHERE id = v_quotation.purchase_order_id;
  ELSE
    UPDATE purchase_orders
    SET total_amount = v_quotation.quoted_amount,
        approval_amount = v_quotation.quoted_amount,
        approval_amount_source = 'selected_quotation',
        selected_quotation_id = p_quotation_id,
        supplier = v_quotation.supplier_name,
        supplier_id = v_quotation.supplier_id,
        status = 'pending_approval',
        updated_at = NOW()
    WHERE id = v_quotation.purchase_order_id;
  END IF;

  PERFORM update_quotation_selection_status(v_quotation.purchase_order_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Quotation selected and PO advanced to pending approval',
    'quotation_id', p_quotation_id,
    'items_replaced', CASE WHEN v_quotation_items IS NOT NULL AND jsonb_array_length(v_quotation_items) > 0 THEN true ELSE false END
  );
END;
$function$;

-- Repair existing rows where total already matches the selected quote but approval_amount drifted.
UPDATE purchase_orders po
SET
  approval_amount = q.quoted_amount,
  approval_amount_source = 'selected_quotation',
  updated_at = NOW()
FROM purchase_order_quotations q
WHERE po.selected_quotation_id = q.id
  AND po.selected_quotation_id IS NOT NULL
  AND po.total_amount = q.quoted_amount
  AND (po.approval_amount IS DISTINCT FROM q.quoted_amount);
