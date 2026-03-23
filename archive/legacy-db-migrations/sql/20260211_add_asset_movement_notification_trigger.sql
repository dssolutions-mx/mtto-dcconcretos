-- =====================================================
-- Migration: 20260211_add_asset_movement_notification_trigger
-- Decision: D004, Recommendation J - GM notified when asset moves between plants
-- =====================================================

-- Add app_settings key for asset movement edge function URL
INSERT INTO public.app_settings (key, value)
VALUES (
  'edge_asset_movement_url',
  'https://txapndpstzcspgxlybll.supabase.co/functions/v1/asset-movement-notification'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Create notify_asset_movement function
CREATE OR REPLACE FUNCTION public.notify_asset_movement()
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
  -- Only notify when asset moved between plants (both IDs set and different)
  IF NEW.previous_plant_id IS NOT NULL
     AND NEW.new_plant_id IS NOT NULL
     AND NEW.previous_plant_id IS DISTINCT FROM NEW.new_plant_id THEN
    v_should_notify := true;
  END IF;

  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_url FROM public.app_settings WHERE key = 'edge_asset_movement_url';
  IF v_url IS NULL OR trim(v_url) = '' THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_bearer FROM public.app_settings WHERE key = 'edge_bearer';

  BEGIN
    v_request_id := net.http_post(
      v_url,
      jsonb_build_object(
        'asset_id', NEW.asset_id,
        'previous_plant_id', NEW.previous_plant_id,
        'new_plant_id', NEW.new_plant_id,
        'changed_by', NEW.changed_by
      ),
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
      'Asset movement notification enqueued',
      format('Request %s: Asset %s moved', v_request_id, NEW.asset_id),
      'ASSET_MOVEMENT_ENQUEUE',
      'asset',
      NEW.asset_id,
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO notifications (user_id, title, message, type, related_entity, entity_id, created_at)
    VALUES (
      null,
      'Asset movement notification FAILED',
      format('Asset %s: %s', NEW.asset_id, SQLERRM),
      'ASSET_MOVEMENT_ERROR',
      'asset',
      NEW.asset_id,
      now()
    );
  END;

  RETURN NEW;
END;
$$;

-- Create trigger on asset_assignment_history
DROP TRIGGER IF EXISTS trg_notify_asset_movement ON public.asset_assignment_history;
CREATE TRIGGER trg_notify_asset_movement
  AFTER INSERT ON public.asset_assignment_history
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_asset_movement();
