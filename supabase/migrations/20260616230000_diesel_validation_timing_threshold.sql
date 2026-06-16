-- Align future-dated validation with backdating threshold (default 120 min).
-- Previously future_vs_created / future_dated_now flagged requires_validation for any
-- positive minute delta (e.g. 1m), causing false positives when cuenta litros was fine.

CREATE OR REPLACE FUNCTION public.trg_mark_tx_for_validation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_latest_ts timestamptz;
  v_is_out_of_order boolean := false;
  v_is_backdated boolean := false;
  v_is_future_now boolean := false;
  v_is_future_vs_created boolean := false;
  v_threshold integer := public.get_diesel_backdating_threshold_minutes();
  v_delta_minutes numeric;
  v_future_minutes_now numeric;
  v_future_minutes_created numeric;
  v_created timestamptz := COALESCE(NEW.created_at, NOW());
  v_notes text := COALESCE(NEW.validation_notes, '');
BEGIN
  SELECT MAX(transaction_date) INTO v_latest_ts
  FROM diesel_transactions
  WHERE warehouse_id = NEW.warehouse_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_latest_ts IS NOT NULL AND NEW.transaction_date < v_latest_ts THEN
    v_is_out_of_order := true;
    v_notes := trim(both ' ' FROM CONCAT(v_notes, CASE WHEN v_notes <> '' THEN ' | ' ELSE '' END,
      'out_of_order:', to_char(v_latest_ts, 'YYYY-MM-DD"T"HH24:MI:SSOF')));
  END IF;

  -- Backdated vs now
  v_delta_minutes := EXTRACT(EPOCH FROM (NOW() - NEW.transaction_date)) / 60.0;
  IF v_delta_minutes > v_threshold THEN
    v_is_backdated := true;
    v_notes := trim(both ' ' FROM CONCAT(v_notes, CASE WHEN v_notes <> '' THEN ' | ' ELSE '' END,
      'backdated:', round(v_delta_minutes)::text, 'm'));
  END IF;

  -- Future-dated vs now (same grace as backdating)
  v_future_minutes_now := EXTRACT(EPOCH FROM (NEW.transaction_date - NOW())) / 60.0;
  IF v_future_minutes_now > v_threshold THEN
    v_is_future_now := true;
    v_notes := trim(both ' ' FROM CONCAT(v_notes, CASE WHEN v_notes <> '' THEN ' | ' ELSE '' END,
      'future_dated_now:', round(v_future_minutes_now)::text, 'm'));
  END IF;

  -- Future-dated vs created_at (same grace — avoids 1m clock skew false positives)
  v_future_minutes_created := EXTRACT(EPOCH FROM (NEW.transaction_date - v_created)) / 60.0;
  IF v_future_minutes_created > v_threshold THEN
    v_is_future_vs_created := true;
    v_notes := trim(both ' ' FROM CONCAT(v_notes, CASE WHEN v_notes <> '' THEN ' | ' ELSE '' END,
      'future_vs_created:', round(v_future_minutes_created)::text, 'm'));
  END IF;

  IF v_is_out_of_order OR v_is_backdated OR v_is_future_now OR v_is_future_vs_created THEN
    NEW.requires_validation := true;
    NEW.validation_notes := v_notes;
  END IF;

  RETURN NEW;
END;
$$;

-- Clear false positives: flagged only for minor future_vs_created within threshold.
UPDATE public.diesel_transactions dt
SET
  requires_validation = false,
  validation_notes = NULL
WHERE dt.requires_validation = true
  AND dt.validation_notes IS NOT NULL
  AND dt.validation_notes ~ '^future_vs_created:[0-9]+m$'
  AND (regexp_match(dt.validation_notes, '^future_vs_created:([0-9]+)m$'))[1]::integer
      <= public.get_diesel_backdating_threshold_minutes();
