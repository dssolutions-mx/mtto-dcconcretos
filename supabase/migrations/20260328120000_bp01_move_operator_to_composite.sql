-- Idempotent: move primary operator assignment from CAMION SITRAK BP-01 component to BP-01-COMPUESTO
-- so composite is the canonical assignment (see composite operator + checklist coverage).

DO $$
DECLARE
  v_composite uuid := 'eab8cb09-1d6c-4ab8-88b0-90bf0cfba747';
  v_truck uuid := '135b269a-b9a5-4f96-872e-83628f9186bd';
  v_operator uuid := '6c0036b9-193c-426e-b8d4-a749e75c4468';
  v_assigned_by uuid;
  v_created_by uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM assets WHERE id = v_composite AND is_composite = true) THEN
    RAISE NOTICE 'Skipping BP-01 migration: composite asset not found';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM asset_operators
    WHERE asset_id = v_composite
      AND operator_id = v_operator
      AND status = 'active'
      AND assignment_type = 'primary'
  ) THEN
    RAISE NOTICE 'Skipping BP-01 migration: operator already primary on composite';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM asset_operators
    WHERE asset_id = v_truck
      AND operator_id = v_operator
      AND status = 'active'
      AND assignment_type = 'primary'
  ) THEN
    RAISE NOTICE 'Skipping BP-01 migration: expected truck assignment not found';
    RETURN;
  END IF;

  SELECT assigned_by, created_by INTO v_assigned_by, v_created_by
  FROM asset_operators
  WHERE asset_id = v_truck
    AND operator_id = v_operator
    AND status = 'active'
    AND assignment_type = 'primary'
  LIMIT 1;

  UPDATE asset_operators
  SET
    status = 'inactive',
    end_date = COALESCE(end_date, CURRENT_DATE),
    updated_at = now()
  WHERE asset_id = v_truck
    AND operator_id = v_operator
    AND status = 'active';

  INSERT INTO asset_operators (
    asset_id,
    operator_id,
    assignment_type,
    start_date,
    status,
    assigned_by,
    created_by,
    updated_by
  ) VALUES (
    v_composite,
    v_operator,
    'primary',
    CURRENT_DATE,
    'active',
    v_assigned_by,
    COALESCE(v_created_by, v_assigned_by),
    COALESCE(v_created_by, v_assigned_by)
  );
END $$;
