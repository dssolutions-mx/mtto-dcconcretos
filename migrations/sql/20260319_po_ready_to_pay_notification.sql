-- =====================================================
-- Migration: 20260319_po_ready_to_pay_notification
-- When a PO becomes fully approved, notify Administration with a
-- print-friendly email so they know they can proceed with payment.
-- =====================================================

-- App settings for the ready-to-pay Edge Function
INSERT INTO public.app_settings (key, value)
VALUES (
  'edge_po_ready_to_pay_url',
  'https://txapndpstzcspgxlybll.supabase.co/functions/v1/po-ready-to-pay-notification'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Trigger function: notify Administration when PO status transitions to 'approved'
CREATE OR REPLACE FUNCTION public.notify_po_ready_to_pay()
RETURNS TRIGGER
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
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Only when status transitions TO 'approved'
  IF coalesce(OLD.status, '') <> 'approved' AND NEW.status = 'approved' THEN
    v_should_notify := true;
  END IF;

  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_url FROM public.app_settings WHERE key = 'edge_po_ready_to_pay_url';
  IF v_url IS NULL OR trim(v_url) = '' THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_bearer FROM public.app_settings WHERE key = 'edge_bearer';

  BEGIN
    v_request_id := net.http_post(
      v_url,
      jsonb_build_object('po_id', NEW.id),
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
    VALUES (
      null,
      'PO ready-to-pay notification enqueued',
      format('Request %s: PO %s (order_id=%s) approved — Admin notified', v_request_id, NEW.id, NEW.order_id),
      'PO_READY_TO_PAY_ENQUEUE',
      'purchase_order',
      NEW.id,
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO notifications (user_id, title, message, type, related_entity, entity_id, created_at)
    VALUES (
      null,
      'PO ready-to-pay notification FAILED',
      format('PO %s: %s', NEW.id, SQLERRM),
      'PO_READY_TO_PAY_ERROR',
      'purchase_order',
      NEW.id,
      now()
    );
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_po_ready_to_pay ON public.purchase_orders;
CREATE TRIGGER trg_notify_po_ready_to_pay
  AFTER UPDATE OF status ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_po_ready_to_pay();
