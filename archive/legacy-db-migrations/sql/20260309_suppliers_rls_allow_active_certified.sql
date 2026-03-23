-- Suppliers RLS: Allow viewing active_certified suppliers
-- Date: 2026-03-09
-- Description: Update policies to include active_certified status so certified suppliers
--              are visible to all users (not just their creator).

-- 1. Suppliers table: allow viewing active and active_certified
DROP POLICY IF EXISTS "Allow view active suppliers" ON suppliers;

CREATE POLICY "Allow view active suppliers" ON suppliers
  FOR SELECT USING (status IN ('active', 'active_certified'));

-- 2. Supplier contacts: allow viewing contacts of active and active_certified suppliers
DROP POLICY IF EXISTS "Allow view supplier contacts" ON supplier_contacts;

CREATE POLICY "Allow view supplier contacts" ON supplier_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_contacts.supplier_id
      AND (s.status IN ('active', 'active_certified') OR s.created_by = auth.uid())
    )
  );
