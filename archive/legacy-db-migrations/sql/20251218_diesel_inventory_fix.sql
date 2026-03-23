-- =====================================================
-- DIESEL INVENTORY FIX MIGRATION
-- Date: 2025-12-18
-- Purpose: Fix balance calculation issues and prevent future race conditions
-- =====================================================

-- =====================================================
-- 1. Create improved balance sync function
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_warehouse_balance_v2(p_warehouse_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC(10,2);
BEGIN
  -- Get the latest transaction balance for this warehouse
  SELECT dt.current_balance
  INTO v_balance
  FROM diesel_transactions dt
  WHERE dt.warehouse_id = p_warehouse_id
  ORDER BY dt.transaction_date DESC, dt.created_at DESC, dt.id DESC
  LIMIT 1;

  -- Update warehouse inventory to match
  UPDATE diesel_warehouses w
  SET 
    current_inventory = COALESCE(v_balance, 0),
    last_updated = NOW()
  WHERE w.id = p_warehouse_id;
END;
$$;

COMMENT ON FUNCTION public.sync_warehouse_balance_v2(UUID) IS 
'Syncs warehouse current_inventory to the latest transaction current_balance. Use this instead of incremental updates to avoid drift.';

-- =====================================================
-- 2. Create database audit function (for UI)
-- =====================================================
CREATE OR REPLACE FUNCTION public.audit_warehouse_balance(p_warehouse_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_inventory NUMERIC(10,2);
  v_latest_tx_balance NUMERIC(10,2);
  v_calculated_sum NUMERIC(10,2);
  v_chain_breaks INTEGER := 0;
  v_warehouse_code TEXT;
  v_warehouse_name TEXT;
  result JSON;
BEGIN
  -- Get warehouse info
  SELECT 
    current_inventory,
    warehouse_code,
    name
  INTO 
    v_stored_inventory,
    v_warehouse_code,
    v_warehouse_name
  FROM diesel_warehouses
  WHERE id = p_warehouse_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'error', 'Warehouse not found'
    );
  END IF;

  -- Get latest transaction balance
  SELECT current_balance
  INTO v_latest_tx_balance
  FROM diesel_transactions
  WHERE warehouse_id = p_warehouse_id
  ORDER BY transaction_date DESC, created_at DESC, id DESC
  LIMIT 1;

  -- Calculate sum from all transactions
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type = 'entry' THEN quantity_liters
      WHEN transaction_type = 'consumption' THEN -quantity_liters
      ELSE 0
    END
  ), 0)
  INTO v_calculated_sum
  FROM diesel_transactions
  WHERE warehouse_id = p_warehouse_id;

  -- Count chain breaks
  WITH ordered_txs AS (
    SELECT 
      current_balance,
      LAG(current_balance) OVER (ORDER BY transaction_date, created_at, id) as prev_tx_balance,
      previous_balance
    FROM diesel_transactions
    WHERE warehouse_id = p_warehouse_id
    ORDER BY transaction_date, created_at, id
  )
  SELECT COUNT(*)
  INTO v_chain_breaks
  FROM ordered_txs
  WHERE ABS(COALESCE(prev_tx_balance, 0) - COALESCE(previous_balance, 0)) > 0.01
    AND prev_tx_balance IS NOT NULL;

  -- Build result
  result := json_build_object(
    'warehouse_id', p_warehouse_id,
    'warehouse_code', v_warehouse_code,
    'warehouse_name', v_warehouse_name,
    'stored_inventory', ROUND(v_stored_inventory, 2),
    'latest_transaction_balance', ROUND(COALESCE(v_latest_tx_balance, 0), 2),
    'calculated_sum', ROUND(v_calculated_sum, 2),
    'discrepancy_stored_vs_calculated', ROUND(v_stored_inventory - v_calculated_sum, 2),
    'discrepancy_latest_vs_calculated', ROUND(COALESCE(v_latest_tx_balance, 0) - v_calculated_sum, 2),
    'chain_breaks', v_chain_breaks,
    'status', CASE
      WHEN ABS(v_stored_inventory - v_calculated_sum) < 0.5 AND v_chain_breaks = 0 THEN 'OK'
      WHEN ABS(v_stored_inventory - v_calculated_sum) < 10 AND v_chain_breaks < 5 THEN 'MINOR'
      WHEN ABS(v_stored_inventory - v_calculated_sum) < 100 OR v_chain_breaks < 20 THEN 'MAJOR'
      ELSE 'CRITICAL'
    END,
    'audited_at', NOW()
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.audit_warehouse_balance(UUID) IS 
'Audits a warehouse by comparing stored inventory, latest transaction balance, and calculated sum. Returns JSON with discrepancies and status.';

-- =====================================================
-- 3. Create improved recalculation function with locking
-- =====================================================
CREATE OR REPLACE FUNCTION public.recalculate_warehouse_balances_v3(
  p_warehouse_id UUID,
  p_initial_balance NUMERIC DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_running NUMERIC(10,2);
  v_count INTEGER := 0;
  v_corrections INTEGER := 0;
  r RECORD;
  v_new_prev NUMERIC(10,2);
  v_new_curr NUMERIC(10,2);
BEGIN
  -- Acquire advisory lock to prevent concurrent recalculations
  IF NOT pg_try_advisory_xact_lock(hashtext(p_warehouse_id::text)) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Another recalculation is already in progress for this warehouse'
    );
  END IF;

  v_running := COALESCE(p_initial_balance, 0);

  -- Process all transactions in chronological order
  FOR r IN
    SELECT id, transaction_type, quantity_liters, previous_balance, current_balance
    FROM diesel_transactions
    WHERE warehouse_id = p_warehouse_id
    ORDER BY transaction_date ASC, created_at ASC, id ASC
  LOOP
    -- Calculate correct balances
    v_new_prev := v_running;
    
    CASE 
      WHEN r.transaction_type = 'entry' THEN
        v_new_curr := v_running + r.quantity_liters;
      WHEN r.transaction_type = 'consumption' THEN
        v_new_curr := v_running - r.quantity_liters;
      ELSE
        v_new_curr := v_running;
    END CASE;

    -- Update if values differ
    IF ABS(COALESCE(r.previous_balance, 0) - v_new_prev) > 0.01 
       OR ABS(COALESCE(r.current_balance, 0) - v_new_curr) > 0.01 THEN
      
      UPDATE diesel_transactions
      SET 
        previous_balance = v_new_prev,
        current_balance = v_new_curr,
        updated_at = NOW()
      WHERE id = r.id;
      
      v_corrections := v_corrections + 1;
    END IF;

    -- Update running balance
    v_running := v_new_curr;
    v_count := v_count + 1;
  END LOOP;

  -- Update warehouse inventory to final balance
  UPDATE diesel_warehouses
  SET 
    current_inventory = v_running,
    last_updated = NOW()
  WHERE id = p_warehouse_id;

  RETURN json_build_object(
    'success', true,
    'transactions_processed', v_count,
    'corrections_made', v_corrections,
    'final_balance', ROUND(v_running, 2)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION public.recalculate_warehouse_balances_v3(UUID, NUMERIC) IS 
'Recalculates all transaction balances for a warehouse with advisory locking to prevent race conditions.';

-- =====================================================
-- 4. Disable the problematic incremental trigger
-- =====================================================
-- The update_warehouse_on_transaction trigger causes drift because it does
-- independent arithmetic instead of syncing to the transaction balance.
-- We'll disable it and replace it with a sync-based approach.

DROP TRIGGER IF EXISTS update_warehouse_inventory_on_transaction ON diesel_transactions;

COMMENT ON FUNCTION public.update_warehouse_on_transaction() IS 
'DEPRECATED: This function caused balance drift. Use sync_warehouse_balance_v2 instead.';

-- =====================================================
-- 5. Create new trigger that syncs instead of increments
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_sync_warehouse_after_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- After any transaction INSERT/UPDATE/DELETE, sync the warehouse balance
  -- to match the latest transaction's current_balance
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_warehouse_balance_v2(OLD.warehouse_id);
  ELSE
    PERFORM public.sync_warehouse_balance_v2(NEW.warehouse_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_warehouse_inventory
  AFTER INSERT OR UPDATE OR DELETE ON diesel_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_warehouse_after_transaction();

COMMENT ON TRIGGER trg_sync_warehouse_inventory ON diesel_transactions IS 
'Syncs warehouse inventory to latest transaction balance. Replaces incremental update trigger.';

-- =====================================================
-- 6. Create balance validation check constraint helper
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_transaction_balance(
  p_transaction_type TEXT,
  p_quantity_liters NUMERIC,
  p_previous_balance NUMERIC,
  p_current_balance NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_expected_current NUMERIC;
BEGIN
  -- Calculate expected current balance
  CASE p_transaction_type
    WHEN 'entry' THEN
      v_expected_current := p_previous_balance + p_quantity_liters;
    WHEN 'consumption' THEN
      v_expected_current := p_previous_balance - p_quantity_liters;
    ELSE
      v_expected_current := p_previous_balance;
  END CASE;

  -- Allow 0.01L tolerance for rounding
  RETURN ABS(p_current_balance - v_expected_current) < 0.01;
END;
$$;

COMMENT ON FUNCTION public.validate_transaction_balance(TEXT, NUMERIC, NUMERIC, NUMERIC) IS 
'Validates that current_balance = previous_balance +/- quantity_liters based on transaction type.';

-- =====================================================
-- 7. Grant permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION public.sync_warehouse_balance_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_warehouse_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_warehouse_balances_v3(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_transaction_balance(TEXT, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

-- =====================================================
-- 8. Create audit log table for balance corrections
-- =====================================================
CREATE TABLE IF NOT EXISTS public.diesel_balance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES diesel_warehouses(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'recalculation', 'manual_adjustment', 'auto_sync'
  old_balance NUMERIC(10,2),
  new_balance NUMERIC(10,2),
  corrections_made INTEGER,
  triggered_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_diesel_audit_warehouse ON diesel_balance_audit_log(warehouse_id, created_at DESC);

COMMENT ON TABLE public.diesel_balance_audit_log IS 
'Audit trail of all balance corrections and recalculations for transparency and debugging.';

-- Grant permissions
GRANT SELECT, INSERT ON public.diesel_balance_audit_log TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- To apply this migration:
-- 1. Review the changes carefully
-- 2. Test in development first
-- 3. Run recalculation script to fix existing data
-- 4. Monitor the new trigger performance

-- To rollback (if needed):
-- DROP TRIGGER IF EXISTS trg_sync_warehouse_inventory ON diesel_transactions;
-- DROP FUNCTION IF EXISTS public.trg_sync_warehouse_after_transaction();
-- -- Re-enable old trigger if necessary
