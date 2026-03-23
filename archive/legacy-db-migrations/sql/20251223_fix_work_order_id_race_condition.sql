-- ========================================
-- Fix Work Order ID Generation Race Condition
-- ========================================
-- This migration fixes the race condition in generate_unique_work_order_id()
-- by adding advisory locks to serialize ID generation and prevent duplicate key violations.

-- 1. Improved function with advisory locks to prevent race conditions
CREATE OR REPLACE FUNCTION generate_unique_work_order_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_n BIGINT;
  v_id TEXT;
  v_attempts INT := 0;
  v_max_attempts INT := 100;
BEGIN
  -- Acquire advisory lock to serialize ID generation across all transactions
  -- This prevents multiple transactions from generating the same ID simultaneously
  PERFORM pg_advisory_xact_lock(123456789); -- Unique lock ID for work_orders ID generation
  
  LOOP
    -- Get next sequence value (atomic operation)
    v_n := nextval('work_order_id_seq');
    
    -- Format as OT-#### (4 digits)
    v_id := 'OT-' || LPAD(v_n::TEXT, 4, '0');
    
    -- Double-check uniqueness within the locked transaction
    -- The lock ensures no other transaction can be checking/inserting at the same time
    IF NOT EXISTS (SELECT 1 FROM work_orders WHERE order_id = v_id) THEN
      RETURN v_id;
    END IF;
    
    -- If collision detected (should be extremely rare with sequence + lock)
    v_attempts := v_attempts + 1;
    IF v_attempts > v_max_attempts THEN
      -- Fallback: use timestamp-based ID with random component
      v_id := 'OT-' || TO_CHAR(EXTRACT(EPOCH FROM NOW()), 'FM00000000') || '-' || 
              LPAD((random() * 9999)::INT::TEXT, 4, '0');
      
      -- Verify fallback ID is unique
      IF NOT EXISTS (SELECT 1 FROM work_orders WHERE order_id = v_id) THEN
        RETURN v_id;
      END IF;
      
      -- Last resort: add more randomness
      RETURN 'OT-' || TO_CHAR(EXTRACT(EPOCH FROM NOW()), 'FM00000000') || '-' || 
             LPAD((random() * 99999)::INT::TEXT, 5, '0');
    END IF;
  END LOOP;
END;
$$;

-- 2. Improved trigger function with better error handling
CREATE OR REPLACE FUNCTION generate_work_order_id_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_generated_id TEXT;
  v_retry_count INT := 0;
  v_max_retries INT := 3;
BEGIN
  -- If order_id is already provided, validate uniqueness
  IF NEW.order_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM work_orders 
      WHERE order_id = NEW.order_id 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'El order_id % ya existe', NEW.order_id;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Generate new ID (the function now handles locking internally)
  -- The advisory lock in generate_unique_work_order_id() ensures atomicity
  v_generated_id := generate_unique_work_order_id();
  
  -- Final uniqueness check before assignment (belt and suspenders)
  IF NOT EXISTS (SELECT 1 FROM work_orders WHERE order_id = v_generated_id) THEN
    NEW.order_id := v_generated_id;
    RETURN NEW;
  END IF;
  
  -- If somehow we still have a collision (extremely unlikely with locks),
  -- retry a few times
  LOOP
    v_generated_id := generate_unique_work_order_id();
    
    IF NOT EXISTS (SELECT 1 FROM work_orders WHERE order_id = v_generated_id) THEN
      NEW.order_id := v_generated_id;
      RETURN NEW;
    END IF;
    
    v_retry_count := v_retry_count + 1;
    IF v_retry_count >= v_max_retries THEN
      -- Last resort: timestamp-based ID
      v_generated_id := 'OT-' || TO_CHAR(EXTRACT(EPOCH FROM NOW()), 'FM00000000') || '-' || 
                        LPAD((random() * 99999)::INT::TEXT, 5, '0');
      NEW.order_id := v_generated_id;
      RETURN NEW;
    END IF;
  END LOOP;
END;
$$;

-- 3. Ensure trigger is properly configured
DROP TRIGGER IF EXISTS trg_generate_work_order_id ON work_orders;
CREATE TRIGGER trg_generate_work_order_id
  BEFORE INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_work_order_id_trigger();

-- 4. Grant necessary permissions
GRANT EXECUTE ON FUNCTION generate_unique_work_order_id() TO anon;
GRANT EXECUTE ON FUNCTION generate_unique_work_order_id() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_unique_work_order_id() TO service_role;

GRANT EXECUTE ON FUNCTION generate_work_order_id_trigger() TO anon;
GRANT EXECUTE ON FUNCTION generate_work_order_id_trigger() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_work_order_id_trigger() TO service_role;



