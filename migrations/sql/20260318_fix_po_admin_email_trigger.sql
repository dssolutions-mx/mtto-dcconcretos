-- =====================================================
-- Migration: 20260318_fix_po_admin_email_trigger
-- Fix: Administration approval emails not sent after technical validation
--      when PO amount <= 5000 MXN (viability paths)
--
-- Root cause: notify_po_pending_approval required total_amount > 5000
-- for the "authorized_by escalation" case. Viability paths (inventory_restock,
-- work_order_cash, mixed) require Admin notification regardless of amount.
--
-- The Edge Function has the correct routing logic; the trigger should fire
-- whenever authorized_by is set and status remains pending_approval.
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_po_pending_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_bearer text;
  v_request_id bigint;
  v_should_notify boolean := false;
BEGIN
  SELECT value INTO v_url FROM public.app_settings WHERE key = 'edge_po_notify_url';
  IF v_url IS NULL OR trim(v_url) = '' THEN
    BEGIN
      v_url := current_setting('app.edge_po_notify_url', true);
    EXCEPTION WHEN OTHERS THEN
      v_url := null;
    END;
  END IF;

  SELECT value INTO v_bearer FROM public.app_settings WHERE key = 'edge_bearer';
  IF v_bearer IS NULL OR trim(v_bearer) = '' THEN
    BEGIN
      v_bearer := current_setting('app.edge_bearer', true);
    EXCEPTION WHEN OTHERS THEN
      v_bearer := null;
    END;
  END IF;

  IF v_url IS NULL OR trim(v_url) = '' THEN
    RAISE EXCEPTION 'CRITICAL: Purchase Order notification URL not configured. Set app_settings.edge_po_notify_url';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF new.status = 'pending_approval' THEN
      v_should_notify := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Technical approved: notify next approver (Admin for viability paths, GM for escalation)
    -- REMOVED: total_amount > 5000 — viability paths require Admin regardless of amount
    IF old.authorized_by IS NULL 
       AND new.authorized_by IS NOT NULL
       AND new.status = 'pending_approval' THEN
      v_should_notify := true;
    -- Viability recorded: Admin confirmed viability, now notify GM for final approval
    ELSIF coalesce(old.viability_state, '') <> 'viable' 
       AND new.viability_state = 'viable'
       AND new.authorized_by IS NOT NULL
       AND new.status = 'pending_approval' THEN
      v_should_notify := true;
    -- Status change to pending_approval
    ELSIF new.status = 'pending_approval' 
       AND old.status IS DISTINCT FROM new.status THEN
      v_should_notify := true;
    END IF;
  END IF;

  IF v_should_notify THEN
    BEGIN
      v_request_id := net.http_post(
        v_url,
        jsonb_build_object('po_id', new.id),
        '{}'::jsonb,
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', CASE 
            WHEN v_bearer IS NOT NULL AND trim(v_bearer) <> '' 
            THEN 'Bearer ' || v_bearer 
            ELSE '' 
          END
        ),
        5000
      );
      INSERT INTO notifications (user_id, title, message, type, related_entity, entity_id, created_at)
      VALUES (null, 'PO notification enqueued',
        format('Queued request_id=%s for PO %s (order_id=%s)', v_request_id, new.id::text, new.order_id),
        'PURCHASE_ORDER_APPROVAL_ENQUEUE', 'purchase_order', new.id, now());
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO notifications (user_id, title, message, type, related_entity, entity_id, created_at)
      VALUES (null, 'PO notification FAILED',
        format('ERROR enqueueing for PO %s: %s', new.id::text, SQLERRM),
        'PURCHASE_ORDER_APPROVAL_ERROR', 'purchase_order', new.id, now());
      RAISE WARNING 'Failed to enqueue PO notification for %: %', new.id, SQLERRM;
    END;
  END IF;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.notify_po_pending_approval() IS
  'Fires Edge Function for PO approval emails. Triggers on: INSERT pending_approval, UPDATE authorized_by (technical approval), UPDATE viability_state to viable, UPDATE status to pending_approval.';
