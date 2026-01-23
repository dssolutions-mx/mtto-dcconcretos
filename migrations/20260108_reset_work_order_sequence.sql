-- Migration: Reset work_order_id_seq to fix 409 Conflict errors
-- Issue: Sequence was behind existing work orders causing duplicate ID attempts
-- Date: 2026-01-08
-- Description: Reset the work_order_id_seq sequence to start after the maximum existing order_id

-- Reset work_order_id_seq to be after the maximum existing order_id
SELECT setval('work_order_id_seq', 
  COALESCE(
    (SELECT MAX(CAST(SUBSTRING(order_id FROM 4) AS INTEGER)) 
     FROM work_orders 
     WHERE order_id ~ '^OT-[0-9]{4}$'),
    0
  ) + 1
);

-- Verify the new sequence value
SELECT 
  currval('work_order_id_seq') AS new_sequence_value,
  (SELECT MAX(CAST(SUBSTRING(order_id FROM 4) AS INTEGER)) 
   FROM work_orders 
   WHERE order_id ~ '^OT-[0-9]{4}$') AS max_existing_order_id,
  'OT-' || LPAD(currval('work_order_id_seq')::TEXT, 4, '0') AS next_order_id;

