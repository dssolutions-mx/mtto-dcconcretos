-- Suppliers Policy Upgrade Migration
-- Date: 2026-03-06
-- Description:
--   1. Expand supplier status to include 'pending' and 'active_certified'
--   2. Add tax_document_url column for Constancia de Situación Fiscal (CSF) PDF
--   3. Create supplier_business_units junction table for many-to-many BU associations

-- ============================================================
-- 1. EXPAND STATUS CHECK CONSTRAINT
-- ============================================================

-- Drop existing constraint and recreate with expanded values
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_status_check;

ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_status_check
  CHECK (status IN ('pending', 'active', 'active_certified', 'inactive', 'suspended', 'blacklisted'));

-- Migrate existing 'active' suppliers to keep as 'active'
-- (They will need to be manually promoted to 'active_certified' by admins)
-- New suppliers default to 'pending' to enforce validation flow
ALTER TABLE suppliers ALTER COLUMN status SET DEFAULT 'pending';

-- ============================================================
-- 2. ADD TAX DOCUMENT URL COLUMN
-- ============================================================

-- URL pointing to the CSF (Constancia de Situación Fiscal) PDF in Supabase Storage
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_document_url TEXT;

-- ============================================================
-- 3. CREATE SUPPLIER_BUSINESS_UNITS JUNCTION TABLE
-- ============================================================

-- Many-to-many: a supplier can serve multiple business units
CREATE TABLE IF NOT EXISTS supplier_business_units (
    supplier_id      UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (supplier_id, business_unit_id)
);

-- Index for fast lookups by business_unit_id
CREATE INDEX IF NOT EXISTS idx_supplier_business_units_bu
    ON supplier_business_units(business_unit_id);

-- ============================================================
-- 4. BACKFILL: migrate existing single business_unit_id associations
-- ============================================================

-- For suppliers that already have a business_unit_id set, create the junction row
INSERT INTO supplier_business_units (supplier_id, business_unit_id)
SELECT id, business_unit_id
FROM suppliers
WHERE business_unit_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. ROW LEVEL SECURITY for new table
-- ============================================================

ALTER TABLE supplier_business_units ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "supplier_business_units_select"
    ON supplier_business_units FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "supplier_business_units_modify"
    ON supplier_business_units FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- NOTES FOR ADMINS
-- ============================================================
-- After running this migration:
--
-- 1. Review existing suppliers with status='active' and promote them
--    to 'active_certified' once you verify their RFC and bank account:
--
--    UPDATE suppliers
--    SET status = 'active_certified'
--    WHERE status = 'active'
--      AND tax_id IS NOT NULL
--      AND bank_account_info->>'account_number' IS NOT NULL;
--
-- 2. New suppliers created via the form will have status='pending'
--    until manually certified by an admin.
--
-- 3. The supplier_business_units table replaces the single
--    business_unit_id field for multi-unit associations.
--    The original business_unit_id column is kept for backwards
--    compatibility and as a "primary" business unit reference.
