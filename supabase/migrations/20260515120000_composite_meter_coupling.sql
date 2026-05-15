-- Composite meter coupling: two boolean columns control whether current_hours
-- and current_kilometers propagate across parent ↔ components via the trigger.
-- Only meaningful on composite parent rows (is_composite = true).

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS composite_sync_hours boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS composite_sync_kilometers boolean NOT NULL DEFAULT true;

-- pumping_truck: pump has its own horometer (independent hours);
-- pump is a fixed asset so km is irrelevant — both dimensions independent.
UPDATE public.assets
SET
  composite_sync_hours = false,
  composite_sync_kilometers = false
WHERE is_composite = true
  AND composite_type = 'pumping_truck';

-- Rewrite the trigger function to respect coupling flags.
-- Reads flags from the composite parent row; defaults to true when no parent found
-- (preserves legacy behavior for components whose composite row lacks the flag).
CREATE OR REPLACE FUNCTION public.sync_composite_readings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_propagating text;
  v_sync_h boolean;
  v_sync_km boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.current_hours IS DISTINCT FROM OLD.current_hours)
       OR (NEW.current_kilometers IS DISTINCT FROM OLD.current_kilometers) THEN

      -- Guard: avoid infinite recursion during propagation
      v_is_propagating := current_setting('app.sync_propagation', true);
      IF v_is_propagating = 'on' THEN
        RETURN NEW;
      END IF;
      PERFORM set_config('app.sync_propagation', 'on', true);

      -- Case A: This asset is a composite → use own coupling flags
      IF NEW.is_composite THEN
        v_sync_h  := COALESCE(NEW.composite_sync_hours, true);
        v_sync_km := COALESCE(NEW.composite_sync_kilometers, true);

        -- Only run an UPDATE when at least one dimension is synced
        IF v_sync_h OR v_sync_km THEN
          UPDATE assets a
          SET
            current_hours = CASE
              WHEN v_sync_h THEN COALESCE(NEW.current_hours, a.current_hours)
              ELSE a.current_hours
            END,
            current_kilometers = CASE
              WHEN v_sync_km THEN COALESCE(NEW.current_kilometers, a.current_kilometers)
              ELSE a.current_kilometers
            END
          FROM asset_composite_relationships rel
          WHERE rel.composite_asset_id = NEW.id
            AND rel.status = 'active'
            AND a.id = rel.component_asset_id
            AND (
              (v_sync_h  AND a.current_hours IS DISTINCT FROM NEW.current_hours)
              OR
              (v_sync_km AND a.current_kilometers IS DISTINCT FROM NEW.current_kilometers)
            );
        END IF;

      ELSE
        -- Case B: This asset is a component → look up parent coupling flags
        -- Use first found active parent composite (a component rarely has >1 composite)
        SELECT
          COALESCE(parent.composite_sync_hours, true),
          COALESCE(parent.composite_sync_kilometers, true)
        INTO v_sync_h, v_sync_km
        FROM asset_composite_relationships rel
        JOIN assets parent ON parent.id = rel.composite_asset_id
        WHERE rel.component_asset_id = NEW.id
          AND rel.status = 'active'
          AND parent.is_composite = true
        LIMIT 1;

        -- Default to true if no composite parent found (handles edge cases)
        v_sync_h  := COALESCE(v_sync_h, true);
        v_sync_km := COALESCE(v_sync_km, true);

        IF v_sync_h OR v_sync_km THEN
          -- Update sibling components
          UPDATE assets a
          SET
            current_hours = CASE
              WHEN v_sync_h THEN COALESCE(NEW.current_hours, a.current_hours)
              ELSE a.current_hours
            END,
            current_kilometers = CASE
              WHEN v_sync_km THEN COALESCE(NEW.current_kilometers, a.current_kilometers)
              ELSE a.current_kilometers
            END
          WHERE a.id IN (
            SELECT r2.component_asset_id
            FROM asset_composite_relationships r
            JOIN asset_composite_relationships r2
              ON r2.composite_asset_id = r.composite_asset_id AND r2.status = 'active'
            WHERE r.component_asset_id = NEW.id
              AND r.status = 'active'
          )
          AND a.id <> NEW.id
          AND (
            (v_sync_h  AND a.current_hours IS DISTINCT FROM NEW.current_hours)
            OR
            (v_sync_km AND a.current_kilometers IS DISTINCT FROM NEW.current_kilometers)
          );

          -- Update the composite parent(s)
          UPDATE assets a
          SET
            current_hours = CASE
              WHEN v_sync_h THEN COALESCE(NEW.current_hours, a.current_hours)
              ELSE a.current_hours
            END,
            current_kilometers = CASE
              WHEN v_sync_km THEN COALESCE(NEW.current_kilometers, a.current_kilometers)
              ELSE a.current_kilometers
            END
          WHERE a.id IN (
            SELECT composite_asset_id
            FROM asset_composite_relationships
            WHERE component_asset_id = NEW.id
              AND status = 'active'
          )
          AND (
            (v_sync_h  AND a.current_hours IS DISTINCT FROM NEW.current_hours)
            OR
            (v_sync_km AND a.current_kilometers IS DISTINCT FROM NEW.current_kilometers)
          );
        END IF;
      END IF;

      PERFORM set_config('app.sync_propagation', 'off', true);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger already exists from 20260427140000_meter_readings_numeric_core_tables.sql.
-- CREATE OR REPLACE FUNCTION above replaces the body in-place; trigger binding unchanged.

GRANT EXECUTE ON FUNCTION public.sync_composite_readings() TO anon, authenticated, service_role;
