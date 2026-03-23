-- Fix MISSING_RETURN: add return records to asset_assignment_history
-- Generated from detect-asset-plant-changes-from-diesel.ts diagnosis
-- Applied via Supabase MCP 2026-02-09
-- WARNING: Run only once. Re-running will create duplicate records.

-- Part 1: Initial 12 return records
INSERT INTO asset_assignment_history (asset_id, previous_plant_id, new_plant_id, changed_by, change_reason, created_at) 
SELECT v.asset_id, v.prev_plant, v.new_plant, 'c34258ca-cc26-409d-b541-046d53b89b21'::uuid, 'Corrección por script detect-asset-plant-changes-from-diesel', v.created_at
FROM (VALUES
  ('6be57c11-a350-4e96-bbca-f3772483ee22'::uuid, 'eb050cd7-5db8-4113-9db6-849ba8af28be'::uuid, 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23'::uuid, '2025-12-03T01:48:00+00'::timestamptz),
  ('135b269a-b9a5-4f96-872e-83628f9186bd'::uuid, 'eb050cd7-5db8-4113-9db6-849ba8af28be'::uuid, '1135fc55-00fb-403e-86db-a97427267f97'::uuid, '2025-12-05T21:30:00+00'::timestamptz),
  ('cc2d54c9-085c-401f-b706-c900cbc19ef3'::uuid, 'eb050cd7-5db8-4113-9db6-849ba8af28be'::uuid, 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23'::uuid, '2025-12-08T04:10:00+00'::timestamptz),
  ('4359b9c3-df94-41c1-92fa-1e94fa92c3f0'::uuid, 'eb050cd7-5db8-4113-9db6-849ba8af28be'::uuid, 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23'::uuid, '2025-10-11T01:11:00+00'::timestamptz),
  ('17016867-86b4-4b4f-ad45-355f9fa84f0d'::uuid, 'eb050cd7-5db8-4113-9db6-849ba8af28be'::uuid, 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23'::uuid, '2026-01-08T00:39:00+00'::timestamptz),
  ('36312a22-0ae3-4002-989d-c6cd0b79583c'::uuid, 'eb050cd7-5db8-4113-9db6-849ba8af28be'::uuid, 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23'::uuid, '2025-11-30T00:42:00+00'::timestamptz),
  ('1a0a80e7-3d64-4af8-acc2-4c7732410a7c'::uuid, 'eb050cd7-5db8-4113-9db6-849ba8af28be'::uuid, 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23'::uuid, '2025-11-28T23:18:00+00'::timestamptz),
  ('7f4bdf10-720a-4946-885a-06bef2648e73'::uuid, 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23'::uuid, '1135fc55-00fb-403e-86db-a97427267f97'::uuid, '2025-05-21T06:00:00+00'::timestamptz),
  ('5a7ec58a-47e0-40b2-8fe9-9bf52d0c11ec'::uuid, 'eb050cd7-5db8-4113-9db6-849ba8af28be'::uuid, 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23'::uuid, '2025-11-12T22:14:00+00'::timestamptz),
  ('3698a07a-91ae-4c46-abff-89db1a4970a2'::uuid, 'eb050cd7-5db8-4113-9db6-849ba8af28be'::uuid, 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23'::uuid, '2026-01-02T19:46:00+00'::timestamptz),
  ('d5410f6b-a46c-4189-b6b3-9c37a7e28abf'::uuid, 'eb050cd7-5db8-4113-9db6-849ba8af28be'::uuid, 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23'::uuid, '2025-11-30T00:43:00+00'::timestamptz),
  ('58417903-e4bf-43ca-a469-cb71c087d1a5'::uuid, 'eb050cd7-5db8-4113-9db6-849ba8af28be'::uuid, 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23'::uuid, '2025-12-01T00:00:00+00'::timestamptz)
) AS v(asset_id, prev_plant, new_plant, created_at);

-- Part 2: Additional returns for assets with later moves (v2)
INSERT INTO asset_assignment_history (asset_id, previous_plant_id, new_plant_id, changed_by, change_reason, created_at) VALUES
('4359b9c3-df94-41c1-92fa-1e94fa92c3f0', 'eb050cd7-5db8-4113-9db6-849ba8af28be', 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23', 'c34258ca-cc26-409d-b541-046d53b89b21', 'Corrección v2: retorno posterior a movimiento 2025-10-14', '2025-10-22T23:52:00+00'),
('5a7ec58a-47e0-40b2-8fe9-9bf52d0c11ec', 'eb050cd7-5db8-4113-9db6-849ba8af28be', 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23', 'c34258ca-cc26-409d-b541-046d53b89b21', 'Corrección v2: retorno posterior a movimiento 2025-11-14', '2026-01-29T21:44:00+00'),
('7f4bdf10-720a-4946-885a-06bef2648e73', 'fb6c2a9b-8faf-4d2b-b4d3-685153af0b23', '1135fc55-00fb-403e-86db-a97427267f97', 'c34258ca-cc26-409d-b541-046d53b89b21', 'Corrección v2: retorno P2→P3 tras movimiento 2026-01-27', '2026-01-28T00:00:00+00');
