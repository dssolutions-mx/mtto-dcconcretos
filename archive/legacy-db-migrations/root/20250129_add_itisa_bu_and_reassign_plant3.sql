-- =====================================================
-- Add ITISA Business Unit and Reassign Plant 3
-- Migration: 20250129_add_itisa_bu_and_reassign_plant3
-- Description: Creates ITISA business unit and reassigns Plant 3 from Tijuana to ITISA
-- =====================================================

-- Step 1: Create ITISA Business Unit
-- Code: BU003 (next available after BU001, BU002)
INSERT INTO business_units (id, name, code, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'ITISA',
  'BU003',
  NOW(),
  NOW()
)
RETURNING id as itisa_bu_id;

-- Store ITISA BU ID in a variable for use in subsequent steps
DO $$
DECLARE
  v_itisa_bu_id UUID;
  v_plant3_id UUID := '1135fc55-00fb-403e-86db-a97427267f97';
  v_tijuana_bu_id UUID := 'f3a054af-aa71-4b8e-8c42-dc789771341e';
BEGIN
  -- Get ITISA BU ID
  SELECT id INTO v_itisa_bu_id
  FROM business_units
  WHERE code = 'BU003'
  LIMIT 1;

  -- Step 2: Update Plant 3's business_unit_id to ITISA
  UPDATE plants
  SET 
    business_unit_id = v_itisa_bu_id,
    updated_at = NOW()
  WHERE id = v_plant3_id;

  -- Step 3: Update user profiles assigned to Plant 3
  -- Update users with plant_id = Plant 3 AND business_unit_id = Tijuana
  UPDATE profiles
  SET 
    business_unit_id = v_itisa_bu_id,
    updated_at = NOW()
  WHERE plant_id = v_plant3_id
    AND business_unit_id = v_tijuana_bu_id;

  -- Log the changes
  RAISE NOTICE 'Plant 3 reassigned to ITISA (BU ID: %)', v_itisa_bu_id;
  RAISE NOTICE 'User profiles updated: % users affected', (SELECT COUNT(*) FROM profiles WHERE plant_id = v_plant3_id AND business_unit_id = v_itisa_bu_id);
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify ITISA business unit was created
DO $$
DECLARE
  v_itisa_count INT;
BEGIN
  SELECT COUNT(*) INTO v_itisa_count
  FROM business_units
  WHERE code = 'BU003' AND name = 'ITISA';
  
  IF v_itisa_count = 1 THEN
    RAISE NOTICE '✓ ITISA business unit created successfully';
  ELSE
    RAISE WARNING '✗ ITISA business unit creation verification failed';
  END IF;
END $$;

-- Verify Plant 3 is assigned to ITISA
DO $$
DECLARE
  v_plant3_bu_id UUID;
  v_itisa_bu_id UUID;
BEGIN
  SELECT business_unit_id INTO v_plant3_bu_id
  FROM plants
  WHERE id = '1135fc55-00fb-403e-86db-a97427267f97';
  
  SELECT id INTO v_itisa_bu_id
  FROM business_units
  WHERE code = 'BU003';
  
  IF v_plant3_bu_id = v_itisa_bu_id THEN
    RAISE NOTICE '✓ Plant 3 successfully assigned to ITISA';
  ELSE
    RAISE WARNING '✗ Plant 3 assignment verification failed';
  END IF;
END $$;

-- Verify assets are accessible via ITISA (through plant relationship)
DO $$
DECLARE
  v_asset_count INT;
BEGIN
  SELECT COUNT(*) INTO v_asset_count
  FROM assets a
  JOIN plants p ON a.plant_id = p.id
  JOIN business_units bu ON p.business_unit_id = bu.id
  WHERE p.id = '1135fc55-00fb-403e-86db-a97427267f97'
    AND bu.code = 'BU003';
  
  RAISE NOTICE '✓ Assets accessible via ITISA: % assets', v_asset_count;
  
  IF v_asset_count != 16 THEN
    RAISE WARNING 'Expected 16 assets, found %', v_asset_count;
  END IF;
END $$;

-- Verify user profiles updated
DO $$
DECLARE
  v_user_count INT;
BEGIN
  SELECT COUNT(*) INTO v_user_count
  FROM profiles
  WHERE plant_id = '1135fc55-00fb-403e-86db-a97427267f97'
    AND business_unit_id IN (SELECT id FROM business_units WHERE code = 'BU003');
  
  RAISE NOTICE '✓ User profiles updated: % users now assigned to ITISA', v_user_count;
END $$;

-- =====================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- =====================================================
-- To rollback this migration, execute:
--
-- DO $$
-- DECLARE
--   v_plant3_id UUID := '1135fc55-00fb-403e-86db-a97427267f97';
--   v_tijuana_bu_id UUID := 'f3a054af-aa71-4b8e-8c42-dc789771341e';
--   v_itisa_bu_id UUID;
-- BEGIN
--   -- Get ITISA BU ID
--   SELECT id INTO v_itisa_bu_id FROM business_units WHERE code = 'BU003';
--   
--   -- Reassign Plant 3 back to Tijuana
--   UPDATE plants
--   SET business_unit_id = v_tijuana_bu_id, updated_at = NOW()
--   WHERE id = v_plant3_id;
--   
--   -- Revert user profiles
--   UPDATE profiles
--   SET business_unit_id = v_tijuana_bu_id, updated_at = NOW()
--   WHERE plant_id = v_plant3_id AND business_unit_id = v_itisa_bu_id;
--   
--   -- Delete ITISA business unit (only if no other plants assigned)
--   DELETE FROM business_units WHERE id = v_itisa_bu_id;
-- END $$;

