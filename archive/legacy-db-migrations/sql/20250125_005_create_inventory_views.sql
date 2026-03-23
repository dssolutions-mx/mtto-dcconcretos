-- =====================================================
-- Inventory System - Views
-- Migration: 20250125_005_create_inventory_views
-- Description: Create views for common queries (low stock, stale reservations, valuation)
-- =====================================================

-- =====================================================
-- 1. Low Stock Alerts View
-- =====================================================
CREATE OR REPLACE VIEW inventory_low_stock_alerts AS
SELECT 
  s.id as stock_id,
  p.id as part_id,
  p.part_number,
  p.name as part_name,
  p.category,
  w.id as warehouse_id,
  w.name as warehouse_name,
  w.warehouse_code,
  pl.id as plant_id,
  pl.name as plant_name,
  s.current_quantity,
  s.reserved_quantity,
  s.current_quantity - s.reserved_quantity as available_quantity,
  s.reorder_point,
  s.min_stock_level,
  s.average_unit_cost,
  CASE 
    WHEN s.current_quantity - s.reserved_quantity <= 0 THEN 'out_of_stock'
    WHEN s.current_quantity - s.reserved_quantity < s.min_stock_level THEN 'critical'
    WHEN s.current_quantity - s.reserved_quantity < s.reorder_point THEN 'low'
    ELSE 'ok'
  END as stock_status
FROM inventory_stock s
JOIN inventory_parts p ON s.part_id = p.id
JOIN inventory_warehouses w ON s.warehouse_id = w.id
JOIN plants pl ON w.plant_id = pl.id
WHERE p.is_active = true
  AND w.is_active = true
  AND s.current_quantity - s.reserved_quantity < COALESCE(s.reorder_point, s.min_stock_level, 0)
ORDER BY 
  CASE 
    WHEN s.current_quantity - s.reserved_quantity <= 0 THEN 1
    WHEN s.current_quantity - s.reserved_quantity < s.min_stock_level THEN 2
    ELSE 3
  END,
  p.name;

COMMENT ON VIEW inventory_low_stock_alerts IS 'Parts below reorder point or out of stock, sorted by urgency';

-- =====================================================
-- 2. Stale Reservations View (> 30 days)
-- =====================================================
CREATE OR REPLACE VIEW inventory_stale_reservations AS
SELECT 
  wo.id as work_order_id,
  wo.order_id as work_order_number,
  wo.status as work_order_status,
  wo.description as work_order_description,
  im.id as movement_id,
  im.quantity as reserved_quantity,
  im.movement_date as reserved_since,
  EXTRACT(DAY FROM NOW() - im.movement_date)::INTEGER as days_reserved,
  p.part_number,
  p.name as part_name,
  w.name as warehouse_name,
  pl.name as plant_name,
  ep.nombre || ' ' || ep.apellido as requested_by
FROM inventory_movements im
JOIN work_orders wo ON im.work_order_id = wo.id
JOIN inventory_parts p ON im.part_id = p.id
JOIN inventory_warehouses w ON im.warehouse_id = w.id
JOIN plants pl ON w.plant_id = pl.id
LEFT JOIN employee_profiles ep ON wo.requested_by = ep.user_id
WHERE im.movement_type = 'reservation'
  AND wo.status NOT IN ('Completada', 'Cancelada', 'Rechazada')
  AND NOW() - im.movement_date > INTERVAL '30 days'
ORDER BY im.movement_date ASC;

COMMENT ON VIEW inventory_stale_reservations IS 'Reservations older than 30 days for active work orders';

-- =====================================================
-- 3. Inventory Valuation View
-- =====================================================
CREATE OR REPLACE VIEW inventory_valuation AS
SELECT 
  w.id as warehouse_id,
  w.name as warehouse_name,
  pl.name as plant_name,
  COUNT(DISTINCT s.part_id) as total_parts,
  SUM(s.current_quantity) as total_units,
  SUM(s.current_quantity * s.average_unit_cost) as total_value,
  SUM(s.reserved_quantity) as total_reserved_units,
  SUM(s.reserved_quantity * s.average_unit_cost) as reserved_value
FROM inventory_stock s
JOIN inventory_warehouses w ON s.warehouse_id = w.id
JOIN plants pl ON w.plant_id = pl.id
JOIN inventory_parts p ON s.part_id = p.id
WHERE p.is_active = true AND w.is_active = true
GROUP BY w.id, w.name, pl.name
ORDER BY pl.name, w.name;

COMMENT ON VIEW inventory_valuation IS 'Inventory value summary by warehouse';
