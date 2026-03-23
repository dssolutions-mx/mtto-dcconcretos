-- =====================================================
-- Migration: 20260211_add_po_action_tokens_quotation_and_user
-- Decisions: D003, D005, D008 - quotation_id, recipient_user_id, get_po_action_token
-- Purpose: Enable GM quote override + robust actor resolution
-- =====================================================

-- 1. Add quotation_id (nullable) for approve-with-specific-quote (GM override)
ALTER TABLE public.po_action_tokens
ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES public.purchase_order_quotations(id) ON DELETE SET NULL;

-- 2. Add recipient_user_id (nullable) for robust actor resolution (fixes profiles.email != auth)
ALTER TABLE public.po_action_tokens
ADD COLUMN IF NOT EXISTS recipient_user_id uuid;

-- 3. Extend get_po_action_token to support optional quotation filter
CREATE OR REPLACE FUNCTION public.get_po_action_token(
  p_po_id uuid,
  p_action text,
  p_recipient_email citext,
  p_quotation_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF p_action NOT IN ('approve','reject') THEN
    RETURN NULL;
  END IF;

  SELECT t.jwt_token INTO v_token
  FROM public.po_action_tokens t
  WHERE t.purchase_order_id = p_po_id
    AND t.recipient_email = p_recipient_email
    AND t.action = p_action
    AND t.expires_at > NOW()
    AND (p_quotation_id IS NULL OR t.quotation_id = p_quotation_id)
  ORDER BY t.created_at DESC
  LIMIT 1;

  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION public.get_po_action_token(uuid, text, citext, uuid) IS 
  'Returns JWT token for PO email action. p_quotation_id optional: when provided, returns token for that specific quote (GM override).';

-- 4. Update process_po_email_action: recipient_user_id, quotation_id, BU escalation (D005, D008, D009, Recommendation C)
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
  v_actor_limit numeric;
  v_amount numeric;
  v_select_result jsonb;
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

  -- Resolve actor: recipient_user_id first (D005), then fallback to email
  IF v_row.recipient_user_id IS NOT NULL THEN
    v_actor := v_row.recipient_user_id;
  ELSE
    SELECT public.get_profile_id_by_email(v_row.recipient_email) INTO v_actor;
  END IF;

  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Actor not found for email');
  END IF;

  -- Get current PO
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = v_row.purchase_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Purchase order not found');
  END IF;

  -- Idempotent: if already approved/rejected, return success (D009)
  IF v_po.status IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', true, 'po_id', v_po.id, 'status', v_po.status, 'idempotent', true);
  END IF;

  -- Only process when awaiting approval or compatible intermediate states
  IF coalesce(v_po.status,'') NOT IN ('pending_approval','quoted','pending_approval_adjustment','pending_approval_special','Pendiente','pending_approval_receipt') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Purchase order not awaiting approval', 'status', v_po.status);
  END IF;

  -- When approve + quotation_id present: select quotation first (GM override)
  IF v_row.action = 'approve' AND v_row.quotation_id IS NOT NULL THEN
    SELECT public.select_quotation(v_row.quotation_id, v_actor, 'Selección desde email de aprobación') INTO v_select_result;
    IF (v_select_result->>'success')::boolean IS NOT TRUE THEN
      RETURN jsonb_build_object('success', false, 'error', coalesce(v_select_result->>'error', 'Quotation selection failed'));
    END IF;
  END IF;

  v_amount := coalesce(v_po.total_amount, 0);

  IF v_row.action = 'approve' THEN
    -- BU escalation: first approval (authorized_by NULL) + amount exceeds actor limit → escalate to GM
    IF v_po.authorized_by IS NULL THEN
      SELECT p.role, p.can_authorize_up_to
        INTO v_profile
        FROM public.profiles p
        WHERE p.id = v_actor;
      v_actor_limit := coalesce(v_profile.can_authorize_up_to, 5000);
      IF v_profile.role = 'GERENCIA_GENERAL' THEN
        v_actor_limit := 999999999;
      END IF;

      IF v_amount > v_actor_limit THEN
        -- First approval, exceeds BU limit: set authorized_by, keep pending_approval (trigger sends to GM)
        UPDATE public.purchase_orders
          SET authorized_by = v_actor,
              authorization_date = now(),
              updated_at = now(),
              updated_by = v_actor
          WHERE id = v_row.purchase_order_id;
        v_new_status := 'pending_approval';
      ELSE
        -- Within limit: full approval
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
      -- GM approval (authorized_by already set)
      UPDATE public.purchase_orders
        SET status = 'approved',
            approval_date = now(),
            approved_by = v_actor,
            updated_at = now(),
            updated_by = v_actor
        WHERE id = v_row.purchase_order_id;
      v_new_status := 'approved';
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

  -- Delete all tokens for this PO+email (and same quotation if any) to prevent reuse
  DELETE FROM public.po_action_tokens
  WHERE purchase_order_id = v_row.purchase_order_id
    AND recipient_email = v_row.recipient_email;

  RETURN jsonb_build_object('success', true, 'po_id', v_row.purchase_order_id, 'status', v_new_status);
END;
$$;
