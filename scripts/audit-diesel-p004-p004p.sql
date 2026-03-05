-- Diesel Audit: P004 & P004P
-- Run via Supabase SQL Editor or MCP execute_sql to validate liter totals.
-- Replace date params as needed (YYYY-MM-DD).

-- 1. Plants P004, P004P
SELECT id, code, name FROM plants WHERE code IN ('P004', 'P004P');

-- 2. Diesel warehouses for P004/P004P
SELECT dw.id, dw.warehouse_code, dw.name, p.code as plant_code
FROM diesel_warehouses dw
JOIN plants p ON p.id = dw.plant_id
WHERE dw.product_type = 'diesel' AND p.code IN ('P004', 'P004P');

-- 3. Total consumption liters by plant (excl transfers)
-- Gerencial route ONLY counts consumptions WITH asset_id → liters_asset_only
-- Full plant total = liters_total (includes general consumptions)
-- Example: Feb 2026 - P004P raw 6930L, gerencial 6380L (550L general excluded)
SELECT p.code,
  COUNT(*) FILTER (WHERE dt.asset_id IS NOT NULL) as tx_with_asset,
  COUNT(*) FILTER (WHERE dt.asset_id IS NULL) as tx_general,
  SUM(CASE WHEN dt.asset_id IS NOT NULL THEN dt.quantity_liters ELSE 0 END) as liters_asset_only,
  SUM(dt.quantity_liters) as liters_total
FROM diesel_transactions dt
JOIN diesel_warehouses dw ON dw.id = dt.warehouse_id
JOIN plants p ON p.id = dw.plant_id
WHERE dt.transaction_type = 'consumption'
  AND (dt.is_transfer IS NULL OR dt.is_transfer = false)
  AND dw.product_type = 'diesel'
  AND p.code IN ('P004', 'P004P')
  AND dt.transaction_date >= '2026-02-01'
  AND dt.transaction_date < '2026-03-01'
GROUP BY p.code
ORDER BY p.code;
