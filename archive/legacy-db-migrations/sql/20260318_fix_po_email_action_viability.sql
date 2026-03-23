-- =====================================================
-- Migration: 20260318_fix_po_email_action_viability
-- Fix: process_po_email_action did not handle AREA_ADMINISTRATIVA viability role.
-- When Administration approves via email, it should record viability_state = 'viable'
-- and viability_checked_by, NOT overwrite authorized_by or fully approve the PO.
-- The DB trigger then fires (viability_state → 'viable') and notifies GM if needed.
-- =====================================================

CREATE OR REPLACE FUNCTION public.process_po_email_action(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_po RECORD;
  v_actor uuid;
  v_new_status text;
  v_profile RECORD;
  v_amount numeric;
  v_select_result jsonb;
  v_po_purpose text;
  v_work_order_type text;
  v_skip_gm boolean;
  v_requires_gm_above_threshold boolean;
  v_needs_gm_escalation boolean;
  v_gm_threshold numeric := 7000;
  v_requires_viability boolean;
BEGIN
  IF p_token IS NULL OR length(p_token) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing token');
  END IF;

  SELECT * INTO v_row
  FROM public.po_action_tokens
  WHERE jwt_token = p_token
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;

  -- Resolve actor: recipient_user_id first, then fallback to email
  IF v_row.recipient_user_id IS NOT NULL THEN
    v_actor := v_row.recipient_user_id;
  ELSE
    SELECT public.get_profile_id_by_email(v_row.recipient_email) INTO v_actor;
  END IF;

  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Actor not found for email');
  END IF;

  -- Get current PO with routing fields
  SELECT id, status, authorized_by, approved_by, viability_state, total_amount, approval_amount,
         po_purpose, work_order_type
  INTO v_po
  FROM public.purchase_orders
  WHERE id = v_row.purchase_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Purchase order not found');
  END IF;

  -- Idempotent: if already approved/rejected, return success
  IF v_po.status IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', true, 'po_id', v_po.id, 'status', v_po.status, 'idempotent', true);
  END IF;

  -- Only process when awaiting approval or compatible intermediate states
  IF coalesce(v_po.status,'') NOT IN ('pending_approval','quoted','pending_approval_adjustment','pending_approval_special','Pendiente','pending_approval_receipt') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Purchase order not awaiting approval', 'status', v_po.status);
  END IF;

  -- When approve + quotation_id present: select quotation first
  IF v_row.action = 'approve' AND v_row.quotation_id IS NOT NULL THEN
    SELECT public.select_quotation(v_row.quotation_id, v_actor, 'Selección desde email de aprobación') INTO v_select_result;
    IF (v_select_result->>'success')::boolean IS NOT TRUE THEN
      RETURN jsonb_build_object('success', false, 'error', coalesce(v_select_result->>'error', 'Quotation selection failed'));
    END IF;
  END IF;

  v_amount := coalesce(v_po.approval_amount, v_po.total_amount, 0);
  v_po_purpose := nullif(trim(lower(coalesce(v_po.po_purpose, ''))), '');
  v_work_order_type := nullif(trim(lower(coalesce(v_po.work_order_type, ''))), '');

  -- Workflow policy (same as lib/purchase-orders/workflow-policy.ts)
  IF v_po_purpose = 'work_order_inventory' AND (v_work_order_type IN ('preventive', 'preventivo')) THEN
    v_skip_gm := true;
    v_requires_gm_above_threshold := false;
    v_requires_viability := false;
  ELSIF v_po_purpose = 'work_order_inventory' AND (v_work_order_type IN ('corrective', 'correctivo')) THEN
    v_skip_gm := (v_amount < v_gm_threshold);
    v_requires_gm_above_threshold := (v_amount >= v_gm_threshold);
    v_requires_viability := false;
  ELSIF v_po_purpose = 'inventory_restock' THEN
    v_skip_gm := (v_amount < v_gm_threshold);
    v_requires_gm_above_threshold := (v_amount >= v_gm_threshold);
    v_requires_viability := true;
  ELSIF v_po_purpose IN ('work_order_cash', 'mixed') THEN
    IF v_work_order_type IN ('preventive', 'preventivo') THEN
      v_skip_gm := true;
      v_requires_gm_above_threshold := false;
    ELSE
      v_skip_gm := (v_amount < v_gm_threshold);
      v_requires_gm_above_threshold := (v_amount >= v_gm_threshold);
    END IF;
    v_requires_viability := true;
  ELSE
    v_skip_gm := (v_amount < v_gm_threshold);
    v_requires_gm_above_threshold := (v_amount >= v_gm_threshold);
    v_requires_viability := false;
  END IF;

  v_needs_gm_escalation := v_requires_gm_above_threshold AND (v_amount >= v_gm_threshold);

  IF v_row.action = 'approve' THEN
    SELECT p.role INTO v_profile
    FROM public.profiles p
    WHERE p.id = v_actor;

    -- ── AREA_ADMINISTRATIVA: record viability, never full-approve ────────────
    IF v_profile.role = 'AREA_ADMINISTRATIVA' THEN
      -- Viability already confirmed (idempotent)
      IF v_po.viability_state = 'viable' THEN
        RETURN jsonb_build_object('success', true, 'po_id', v_po.id, 'status', v_po.status, 'viability', 'already_recorded');
      END IF;
      UPDATE public.purchase_orders
        SET viability_state = 'viable',
            viability_checked_by = v_actor,
            updated_at = now(),
            updated_by = v_actor
        WHERE id = v_row.purchase_order_id;
      -- Trigger trg_notify_po_pending_approval fires on viability_state update
      -- and will send GM email if needed.
      v_new_status := 'viability_recorded';

    -- ── GERENCIA_GENERAL: can always fully approve ───────────────────────────
    ELSIF v_profile.role = 'GERENCIA_GENERAL' THEN
      UPDATE public.purchase_orders
        SET status = 'approved',
            approval_date = now(),
            approved_by = v_actor,
            updated_at = now(),
            updated_by = v_actor
        WHERE id = v_row.purchase_order_id;
      v_new_status := 'approved';

    -- ── GERENTE_MANTENIMIENTO or technical approver ──────────────────────────
    ELSIF v_po.authorized_by IS NULL THEN
      -- First approval slot is free: this is the technical approver
      IF v_needs_gm_escalation AND NOT v_skip_gm THEN
        -- Amount >= 7000 on a non-skip path: record technical approval, escalate to GM via trigger
        UPDATE public.purchase_orders
          SET authorized_by = v_actor,
              authorization_date = now(),
              updated_at = now(),
              updated_by = v_actor
          WHERE id = v_row.purchase_order_id;
        v_new_status := 'pending_approval';
      ELSIF v_requires_viability THEN
        -- Path requires viability: record technical approval, trigger notifies Admin
        UPDATE public.purchase_orders
          SET authorized_by = v_actor,
              authorization_date = now(),
              updated_at = now(),
              updated_by = v_actor
          WHERE id = v_row.purchase_order_id;
        v_new_status := 'pending_approval';
      ELSE
        -- No viability, no GM needed: full approval
        UPDATE public.purchase_orders
          SET status = 'approved',
              approval_date = now(),
              approved_by = v_actor,
              updated_at = now(),
              updated_by = v_actor
          WHERE id = v_row.purchase_order_id;
        v_new_status := 'approved';
      END IF;
    ELSE
      -- authorized_by already set, actor is not GM or Admin: nothing to do
      RETURN jsonb_build_object('success', false, 'error', 'Esta orden ya tiene aprobación técnica registrada y requiere otro rol para continuar.');
    END IF;

  ELSIF v_row.action = 'reject' THEN
    UPDATE public.purchase_orders
      SET status = 'rejected',
          updated_at = now(),
          updated_by = v_actor
    WHERE id = v_row.purchase_order_id;
    v_new_status := 'rejected';
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;

  -- Delete all tokens for this PO+email to prevent reuse
  DELETE FROM public.po_action_tokens
  WHERE purchase_order_id = v_row.purchase_order_id
    AND recipient_email = v_row.recipient_email;

  RETURN jsonb_build_object('success', true, 'po_id', v_row.purchase_order_id, 'status', v_new_status);
END;
$$;

COMMENT ON FUNCTION public.process_po_email_action(text) IS
  'Process PO email action token. AREA_ADMINISTRATIVA records viability only. GERENCIA_GENERAL fully approves. GERENTE_MANTENIMIENTO records technical approval.';
