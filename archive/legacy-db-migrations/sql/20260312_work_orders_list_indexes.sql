-- Indexes for work orders list API performance
-- Speeds up: ORDER BY created_at, filtering by status/asset_id, search by order_id

-- Primary sort: list is ordered by created_at DESC
CREATE INDEX IF NOT EXISTS idx_work_orders_created_at_desc
  ON work_orders (created_at DESC NULLS LAST);

-- Filter by status (tab: pending/completed)
CREATE INDEX IF NOT EXISTS idx_work_orders_status
  ON work_orders (status)
  WHERE status IS NOT NULL;

-- Filter by asset
CREATE INDEX IF NOT EXISTS idx_work_orders_asset_id
  ON work_orders (asset_id)
  WHERE asset_id IS NOT NULL;

-- Search by order_id (Buscar)
CREATE INDEX IF NOT EXISTS idx_work_orders_order_id_lower
  ON work_orders (lower(order_id));
