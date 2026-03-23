-- =====================================================
-- Diesel Management System - Production Tables
-- Migration: 20251001_diesel_production_tables
-- Description: Add balance tracking, evidence, and snapshots
-- =====================================================

-- =====================================================
-- 1. Add balance tracking to diesel_transactions
-- =====================================================
ALTER TABLE diesel_transactions 
ADD COLUMN IF NOT EXISTS previous_balance NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS current_balance NUMERIC(10,2);

COMMENT ON COLUMN diesel_transactions.previous_balance IS 'Warehouse balance before this transaction (for traceability)';
COMMENT ON COLUMN diesel_transactions.current_balance IS 'Warehouse balance after this transaction (for traceability)';

-- =====================================================
-- 2. Create diesel_evidence table
-- =====================================================
CREATE TABLE IF NOT EXISTS diesel_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES diesel_transactions(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('consumption', 'entry', 'adjustment', 'meter_reading', 'cuenta_litros', 'delivery', 'invoice')),
  photo_url TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('machine_display', 'cuenta_litros', 'delivery_truck', 'invoice', 'before', 'after', 'tank_gauge', 'other')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  
  -- Ensure evidence type matches transaction type
  CONSTRAINT evidence_transaction_type_match CHECK (
    (evidence_type = 'consumption' AND category IN ('machine_display', 'cuenta_litros', 'before', 'after')) OR
    (evidence_type = 'entry' AND category IN ('delivery_truck', 'invoice', 'tank_gauge', 'before', 'after')) OR
    (evidence_type IN ('adjustment', 'meter_reading') AND category IN ('before', 'after', 'tank_gauge', 'other'))
  )
);

COMMENT ON TABLE diesel_evidence IS 'Photo evidence for diesel transactions - required for consumptions and entries';
COMMENT ON COLUMN diesel_evidence.evidence_type IS 'Type of evidence: consumption, entry, adjustment, meter_reading, cuenta_litros, delivery, invoice';
COMMENT ON COLUMN diesel_evidence.category IS 'Evidence category: machine_display, cuenta_litros, delivery_truck, invoice, before, after, tank_gauge';
COMMENT ON COLUMN diesel_evidence.metadata IS 'JSON metadata: {original_size, compressed_size, device_info, timestamp}';

-- =====================================================
-- 3. Create diesel_inventory_snapshots table
-- =====================================================
CREATE TABLE IF NOT EXISTS diesel_inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES diesel_warehouses(id),
  snapshot_date DATE NOT NULL,
  opening_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_entries NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_consumptions NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_adjustments NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(10,2) NOT NULL,
  physical_count NUMERIC(10,2),
  variance NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE 
      WHEN physical_count IS NOT NULL THEN physical_count - closing_balance
      ELSE NULL
    END
  ) STORED,
  notes TEXT,
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(warehouse_id, snapshot_date),
  
  -- Ensure closing balance is calculated correctly
  CONSTRAINT snapshot_balance_check CHECK (
    closing_balance = opening_balance + total_entries - total_consumptions + total_adjustments
  )
);

COMMENT ON TABLE diesel_inventory_snapshots IS 'Daily/monthly inventory snapshots for reconciliation and fast queries';
COMMENT ON COLUMN diesel_inventory_snapshots.physical_count IS 'Physical count from manual inspection (optional)';
COMMENT ON COLUMN diesel_inventory_snapshots.variance IS 'Difference between physical count and calculated balance';
COMMENT ON COLUMN diesel_inventory_snapshots.validated_by IS 'User who validated the snapshot';

-- =====================================================
-- 4. Create indices for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_diesel_evidence_transaction 
  ON diesel_evidence(transaction_id);

CREATE INDEX IF NOT EXISTS idx_diesel_evidence_type 
  ON diesel_evidence(evidence_type);

CREATE INDEX IF NOT EXISTS idx_diesel_evidence_created 
  ON diesel_evidence(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_diesel_snapshots_warehouse_date 
  ON diesel_inventory_snapshots(warehouse_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_diesel_transactions_balance 
  ON diesel_transactions(warehouse_id, transaction_date DESC) 
  WHERE current_balance IS NOT NULL;

-- =====================================================
-- 5. Create function to calculate warehouse balance
-- =====================================================
CREATE OR REPLACE FUNCTION get_warehouse_current_balance(p_warehouse_id UUID)
RETURNS NUMERIC(10,2) AS $$
DECLARE
  v_balance NUMERIC(10,2);
BEGIN
  -- Try to get the most recent transaction balance
  SELECT current_balance INTO v_balance
  FROM diesel_transactions
  WHERE warehouse_id = p_warehouse_id
    AND current_balance IS NOT NULL
  ORDER BY transaction_date DESC, created_at DESC
  LIMIT 1;
  
  -- If no transaction found, calculate from scratch
  IF v_balance IS NULL THEN
    SELECT COALESCE(
      SUM(CASE 
        WHEN transaction_type = 'entry' THEN quantity_liters
        WHEN transaction_type = 'consumption' THEN -quantity_liters
        WHEN transaction_type = 'adjustment' AND quantity_liters > 0 THEN quantity_liters
        WHEN transaction_type = 'adjustment' AND quantity_liters < 0 THEN quantity_liters
        ELSE 0
      END),
      0
    ) INTO v_balance
    FROM diesel_transactions
    WHERE warehouse_id = p_warehouse_id;
  END IF;
  
  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_warehouse_current_balance(UUID) IS 'Get current balance for a warehouse (from last transaction or calculated)';

-- =====================================================
-- 6. Create trigger to update timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_diesel_snapshot_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER diesel_snapshot_update_timestamp
  BEFORE UPDATE ON diesel_inventory_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_diesel_snapshot_timestamp();

-- =====================================================
-- 7. Create function to generate daily snapshots
-- =====================================================
CREATE OR REPLACE FUNCTION generate_diesel_snapshot(
  p_warehouse_id UUID,
  p_snapshot_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
  v_snapshot_id UUID;
  v_opening_balance NUMERIC(10,2);
  v_entries NUMERIC(10,2);
  v_consumptions NUMERIC(10,2);
  v_adjustments NUMERIC(10,2);
  v_closing_balance NUMERIC(10,2);
BEGIN
  -- Get opening balance (closing balance from previous day)
  SELECT closing_balance INTO v_opening_balance
  FROM diesel_inventory_snapshots
  WHERE warehouse_id = p_warehouse_id
    AND snapshot_date < p_snapshot_date
  ORDER BY snapshot_date DESC
  LIMIT 1;
  
  -- If no previous snapshot, calculate from all transactions
  IF v_opening_balance IS NULL THEN
    SELECT COALESCE(
      SUM(CASE 
        WHEN transaction_type = 'entry' THEN quantity_liters
        WHEN transaction_type = 'consumption' THEN -quantity_liters
        WHEN transaction_type = 'adjustment' THEN quantity_liters
        ELSE 0
      END),
      0
    ) INTO v_opening_balance
    FROM diesel_transactions
    WHERE warehouse_id = p_warehouse_id
      AND DATE(transaction_date) < p_snapshot_date;
  END IF;
  
  -- Calculate day's movements
  SELECT 
    COALESCE(SUM(CASE WHEN transaction_type = 'entry' THEN quantity_liters ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'consumption' THEN quantity_liters ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'adjustment' THEN quantity_liters ELSE 0 END), 0)
  INTO v_entries, v_consumptions, v_adjustments
  FROM diesel_transactions
  WHERE warehouse_id = p_warehouse_id
    AND DATE(transaction_date) = p_snapshot_date;
  
  v_closing_balance := v_opening_balance + v_entries - v_consumptions + v_adjustments;
  
  -- Insert or update snapshot
  INSERT INTO diesel_inventory_snapshots (
    warehouse_id,
    snapshot_date,
    opening_balance,
    total_entries,
    total_consumptions,
    total_adjustments,
    closing_balance
  ) VALUES (
    p_warehouse_id,
    p_snapshot_date,
    v_opening_balance,
    v_entries,
    v_consumptions,
    v_adjustments,
    v_closing_balance
  )
  ON CONFLICT (warehouse_id, snapshot_date) 
  DO UPDATE SET
    opening_balance = EXCLUDED.opening_balance,
    total_entries = EXCLUDED.total_entries,
    total_consumptions = EXCLUDED.total_consumptions,
    total_adjustments = EXCLUDED.total_adjustments,
    closing_balance = EXCLUDED.closing_balance,
    updated_at = NOW()
  RETURNING id INTO v_snapshot_id;
  
  RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_diesel_snapshot(UUID, DATE) IS 'Generate or update daily inventory snapshot for a warehouse';

-- =====================================================
-- 8. Sample data for testing (optional - uncomment if needed)
-- =====================================================
/*
-- Example: Generate snapshots for all active warehouses for yesterday
DO $$
DECLARE
  w RECORD;
BEGIN
  FOR w IN SELECT id FROM diesel_warehouses LOOP
    PERFORM generate_diesel_snapshot(w.id, CURRENT_DATE - 1);
  END LOOP;
END $$;
*/

-- =====================================================
-- 9. Grant permissions
-- =====================================================
-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON diesel_evidence TO authenticated;
GRANT SELECT, INSERT, UPDATE ON diesel_inventory_snapshots TO authenticated;
GRANT EXECUTE ON FUNCTION get_warehouse_current_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_diesel_snapshot(UUID, DATE) TO authenticated;

-- =====================================================
-- Migration Complete
-- =====================================================
-- Summary:
-- ✅ Added balance tracking columns to diesel_transactions
-- ✅ Created diesel_evidence table for photo evidence
-- ✅ Created diesel_inventory_snapshots for daily reconciliation
-- ✅ Added performance indices
-- ✅ Created helper functions for balance calculation
-- ✅ Created snapshot generation function
-- ✅ Set up triggers and permissions

