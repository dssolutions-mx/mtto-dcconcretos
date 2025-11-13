-- Migration: Auto-create work orders for pending issues older than 1 hour
-- This sets up a database function and pg_cron job to automatically create
-- work orders for checklist issues that haven't been processed

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to auto-create work orders for pending issues
CREATE OR REPLACE FUNCTION auto_create_pending_work_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_checklist record;
  v_issue record;
  v_work_order_id text;
  v_asset_id uuid;
  v_asset_name text;
  v_priority text;
  v_description text;
  v_created_count integer := 0;
  v_error_count integer := 0;
  v_checklist_ids text[] := ARRAY[]::text[];
  v_one_hour_ago timestamp;
BEGIN
  -- Calculate 1 hour ago timestamp
  v_one_hour_ago := NOW() - INTERVAL '1 hour';

  RAISE NOTICE 'Starting auto-create check for issues older than %', v_one_hour_ago;

  -- Find all checklists with unresolved issues older than 1 hour
  FOR v_checklist IN
    SELECT DISTINCT
      ci.checklist_id,
      cc.asset_id,
      cc.completion_date,
      cc.completed_items,
      a.name as asset_name,
      a.asset_id as asset_code
    FROM checklist_issues ci
    JOIN completed_checklists cc ON ci.checklist_id = cc.id
    JOIN assets a ON cc.asset_id = a.id
    WHERE ci.resolved = false
      AND cc.completion_date < v_one_hour_ago
      AND NOT EXISTS (
        -- Check if work orders already exist for this checklist
        SELECT 1 FROM work_orders wo
        WHERE wo.checklist_id = ci.checklist_id
      )
    ORDER BY cc.completion_date ASC
  LOOP
    BEGIN
      RAISE NOTICE 'Processing checklist % (asset: %)', v_checklist.checklist_id, v_checklist.asset_name;

      -- Get all unresolved issues for this checklist (excluding cleanliness and security)
      FOR v_issue IN
        SELECT
          ci.id,
          ci.item_id,
          ci.description,
          ci.notes,
          ci.status,
          ci.photo_url
        FROM checklist_issues ci
        WHERE ci.checklist_id = v_checklist.checklist_id
          AND ci.resolved = false
          -- Exclude cleanliness and security sections
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(v_checklist.completed_items) AS item
            WHERE (item->>'item_id')::text = ci.item_id
              AND (item->>'section_type')::text IN ('cleanliness_bonus', 'security_talk')
          )
      LOOP
        -- Determine priority based on status
        v_priority := CASE
          WHEN v_issue.status = 'fail' THEN 'Alta'
          ELSE 'Media'
        END;

        -- Build description
        v_description := v_issue.description || E'\n\n' || COALESCE(v_issue.notes, '');

        -- Generate unique work order ID
        v_work_order_id := (SELECT generate_unique_work_order_id());

        -- Check for similar existing open work orders using fingerprint
        DECLARE
          v_fingerprint text;
          v_similar_wo_id uuid;
        BEGIN
          -- Generate fingerprint for this issue (cast UUID to text)
          v_fingerprint := (
            SELECT generate_issue_fingerprint(
              v_checklist.asset_id::text,
              v_issue.description,
              v_issue.status,
              COALESCE(v_issue.notes, '')
            )
          );

          -- Update issue_fingerprint if missing
          UPDATE checklist_issues
          SET issue_fingerprint = v_fingerprint
          WHERE id = v_issue.id
            AND (issue_fingerprint IS NULL OR issue_fingerprint = '');

          -- Find similar open work orders within 30 days using existing deduplication approach
          -- Query checklist_issues with fingerprints and join to work_orders (matching existing system)
          SELECT wo.id INTO v_similar_wo_id
          FROM checklist_issues ci_similar
          JOIN work_orders wo ON ci_similar.work_order_id = wo.id
          WHERE ci_similar.issue_fingerprint = v_fingerprint
            AND ci_similar.resolved = false
            AND wo.asset_id = v_checklist.asset_id
            AND wo.status IN ('Pendiente', 'En Progreso', 'en_progreso', 'pendiente')
            AND wo.created_at > NOW() - INTERVAL '30 days'
          ORDER BY wo.created_at DESC
          LIMIT 1;

          IF v_similar_wo_id IS NOT NULL THEN
            -- Consolidate with existing work order
            RAISE NOTICE 'Consolidating issue % with existing work order %', v_issue.id, v_similar_wo_id;

            -- Update existing work order description
            UPDATE work_orders
            SET
              description = description || E'\n\n--- Problema adicional (Auto-consolidado) ---\n' || v_description,
              priority = CASE
                WHEN v_priority = 'Alta' THEN 'Alta'  -- Escalate if new issue is high priority
                ELSE priority
              END,
              updated_at = NOW()
            WHERE id = v_similar_wo_id;

            -- Link the issue to the existing work order and update fingerprint
            UPDATE checklist_issues
            SET 
              resolved = true,
              work_order_id = v_similar_wo_id,
              issue_fingerprint = v_fingerprint
            WHERE id = v_issue.id;

            -- Add to incident history
            INSERT INTO incident_history (
              work_order_id,
              status,
              notes,
              changed_by
            ) VALUES (
              v_similar_wo_id,
              'En Progreso',
              'Problema adicional consolidado automáticamente: ' || v_issue.description,
              'system_auto_create'
            );

          ELSE
            -- Create new work order
            RAISE NOTICE 'Creating new work order % for issue %', v_work_order_id, v_issue.id;

            -- Insert work order (order_id will be generated by trigger, or use v_work_order_id)
            DECLARE
              v_new_wo_id uuid;
            BEGIN
              INSERT INTO work_orders (
                order_id,
                asset_id,
                description,
                priority,
                status,
                type,
                checklist_id,
                created_at,
                updated_at
              ) VALUES (
                v_work_order_id,
                v_checklist.asset_id,
                '[AUTO-CREADO] ' || v_description,
                v_priority,
                'Pendiente',
                'Correctivo',
                v_checklist.checklist_id,
                NOW(),
                NOW()
              ) RETURNING id INTO v_new_wo_id;

              -- Mark issue as resolved and link to work order
              UPDATE checklist_issues
              SET 
                resolved = true,
                work_order_id = v_new_wo_id,
                issue_fingerprint = v_fingerprint
              WHERE id = v_issue.id;

              -- Create incident history entry
              INSERT INTO incident_history (
                work_order_id,
                status,
                notes,
                changed_by
              ) VALUES (
                v_new_wo_id,
                'Pendiente',
                'Orden de trabajo creada automáticamente después de 1 hora sin acción manual',
                'system_auto_create'
              );

              -- Increment created count only when a new work order is actually created
              v_created_count := v_created_count + 1;
            END;
          END IF;

        END;
      END LOOP;

      -- Track processed checklist (but don't increment created_count here - it's incremented per work order created)
      v_checklist_ids := array_append(v_checklist_ids, v_checklist.checklist_id);

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error processing checklist %: %', v_checklist.checklist_id, SQLERRM;
      v_error_count := v_error_count + 1;
    END;
  END LOOP;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'created_count', v_created_count,
    'error_count', v_error_count,
    'checklist_ids', v_checklist_ids,
    'processed_at', NOW()
  );

  RAISE NOTICE 'Auto-create completed: % checklists processed, % errors', v_created_count, v_error_count;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auto_create_pending_work_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_create_pending_work_orders() TO service_role;

-- Create pg_cron job to run every hour
-- Note: This requires the pg_cron extension and appropriate permissions
-- Run this in the Supabase SQL Editor with elevated permissions

-- First, unschedule any existing job with the same name (safely)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-create-pending-work-orders');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist yet, that's fine
    NULL;
END
$$;

-- Schedule the job to run every hour at minute 0
SELECT cron.schedule(
  'auto-create-pending-work-orders',     -- Job name
  '0 * * * *',                           -- Cron schedule: every hour
  $$SELECT auto_create_pending_work_orders()$$  -- SQL command to execute
);

-- Verify the job was scheduled
SELECT * FROM cron.job WHERE jobname = 'auto-create-pending-work-orders';

-- Optional: Create a table to log auto-creation runs
CREATE TABLE IF NOT EXISTS auto_create_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamp DEFAULT NOW(),
  result jsonb,
  success boolean,
  error text
);

-- Add RLS policy
ALTER TABLE auto_create_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role to manage auto_create_logs"
  ON auto_create_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create a logging wrapper function
CREATE OR REPLACE FUNCTION auto_create_pending_work_orders_with_logging()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Call the main function
  v_result := auto_create_pending_work_orders();

  -- Log the result
  INSERT INTO auto_create_logs (result, success)
  VALUES (v_result, true);

EXCEPTION WHEN OTHERS THEN
  -- Log the error
  INSERT INTO auto_create_logs (result, success, error)
  VALUES (
    jsonb_build_object('error', SQLERRM),
    false,
    SQLERRM
  );
END;
$$;

-- Update the cron job to use the logging wrapper
DO $$
BEGIN
  PERFORM cron.unschedule('auto-create-pending-work-orders');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;

SELECT cron.schedule(
  'auto-create-pending-work-orders',
  '0 * * * *',
  $$SELECT auto_create_pending_work_orders_with_logging()$$
);

-- Comment for documentation
COMMENT ON FUNCTION auto_create_pending_work_orders() IS
'Automatically creates work orders for checklist issues that are older than 1 hour and have not been processed. Excludes cleanliness and security section items. Consolidates with existing similar work orders when possible.';
