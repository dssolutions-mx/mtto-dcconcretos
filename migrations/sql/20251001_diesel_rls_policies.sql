-- =====================================================
-- Diesel Management System - RLS Policies
-- Migration: 20251001_diesel_rls_policies
-- Description: Row Level Security for diesel tables
-- =====================================================

-- =====================================================
-- 1. DIESEL TRANSACTIONS POLICIES
-- =====================================================

-- Policy: Users can view diesel transactions in their business unit
CREATE POLICY "Users see diesel transactions in their business unit"
  ON diesel_transactions FOR SELECT
  USING (
    plant_id IN (
      SELECT p.id FROM plants p
      INNER JOIN profiles pr ON pr.business_unit_id = p.business_unit_id
      WHERE pr.id = auth.uid()
    )
    OR
    plant_id IN (
      SELECT plant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can create diesel transactions in their assigned plants
CREATE POLICY "Users create diesel transactions in their plants"
  ON diesel_transactions FOR INSERT
  WITH CHECK (
    plant_id IN (
      SELECT plant_id FROM profiles WHERE id = auth.uid()
    )
    OR
    plant_id IN (
      SELECT p.id FROM plants p
      INNER JOIN profiles pr ON pr.business_unit_id = p.business_unit_id
      WHERE pr.id = auth.uid()
        AND pr.role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'ENCARGADO_MANTENIMIENTO')
    )
  );

-- Policy: Users can update their own transactions (within 24 hours)
CREATE POLICY "Users update own diesel transactions within 24h"
  ON diesel_transactions FOR UPDATE
  USING (
    created_by = auth.uid()
    AND created_at > NOW() - INTERVAL '24 hours'
  )
  WITH CHECK (
    created_by = auth.uid()
  );

-- Policy: Supervisors can validate any transaction in their scope
CREATE POLICY "Supervisors validate diesel transactions"
  ON diesel_transactions FOR UPDATE
  USING (
    plant_id IN (
      SELECT p.id FROM plants p
      INNER JOIN profiles pr ON pr.business_unit_id = p.business_unit_id
      WHERE pr.id = auth.uid()
        AND pr.role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'ENCARGADO_MANTENIMIENTO', 'JEFE_PLANTA')
    )
  )
  WITH CHECK (
    plant_id IN (
      SELECT p.id FROM plants p
      INNER JOIN profiles pr ON pr.business_unit_id = p.business_unit_id
      WHERE pr.id = auth.uid()
        AND pr.role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'ENCARGADO_MANTENIMIENTO', 'JEFE_PLANTA')
    )
  );

-- =====================================================
-- 2. DIESEL EVIDENCE POLICIES
-- =====================================================

-- Policy: Users can view evidence for transactions they can see
CREATE POLICY "Users see evidence for accessible transactions"
  ON diesel_evidence FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM diesel_transactions
    )
  );

-- Policy: Users can upload evidence for their transactions
CREATE POLICY "Users upload evidence for their transactions"
  ON diesel_evidence FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND transaction_id IN (
      SELECT id FROM diesel_transactions WHERE created_by = auth.uid()
    )
  );

-- Policy: Users can upload evidence for any transaction in their plant (for supervisors)
CREATE POLICY "Supervisors upload evidence for any transaction"
  ON diesel_evidence FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND transaction_id IN (
      SELECT dt.id FROM diesel_transactions dt
      INNER JOIN plants p ON dt.plant_id = p.id
      INNER JOIN profiles pr ON pr.business_unit_id = p.business_unit_id
      WHERE pr.id = auth.uid()
        AND pr.role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'ENCARGADO_MANTENIMIENTO', 'JEFE_PLANTA')
    )
  );

-- Policy: Users can delete their own evidence (within 1 hour)
CREATE POLICY "Users delete own evidence within 1h"
  ON diesel_evidence FOR DELETE
  USING (
    created_by = auth.uid()
    AND created_at > NOW() - INTERVAL '1 hour'
  );

-- =====================================================
-- 3. DIESEL INVENTORY SNAPSHOTS POLICIES
-- =====================================================

-- Policy: Users can view snapshots for warehouses in their business unit
CREATE POLICY "Users see snapshots in their business unit"
  ON diesel_inventory_snapshots FOR SELECT
  USING (
    warehouse_id IN (
      SELECT w.id FROM diesel_warehouses w
      INNER JOIN plants p ON w.plant_id = p.id
      INNER JOIN profiles pr ON pr.business_unit_id = p.business_unit_id
      WHERE pr.id = auth.uid()
    )
    OR
    warehouse_id IN (
      SELECT w.id FROM diesel_warehouses w
      INNER JOIN profiles pr ON w.plant_id = pr.plant_id
      WHERE pr.id = auth.uid()
    )
  );

-- Policy: Supervisors can create/update snapshots
CREATE POLICY "Supervisors manage snapshots"
  ON diesel_inventory_snapshots FOR ALL
  USING (
    warehouse_id IN (
      SELECT w.id FROM diesel_warehouses w
      INNER JOIN plants p ON w.plant_id = p.id
      INNER JOIN profiles pr ON pr.business_unit_id = p.business_unit_id
      WHERE pr.id = auth.uid()
        AND pr.role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'ENCARGADO_MANTENIMIENTO', 'JEFE_PLANTA')
    )
  )
  WITH CHECK (
    warehouse_id IN (
      SELECT w.id FROM diesel_warehouses w
      INNER JOIN plants p ON w.plant_id = p.id
      INNER JOIN profiles pr ON pr.business_unit_id = p.business_unit_id
      WHERE pr.id = auth.uid()
        AND pr.role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'ENCARGADO_MANTENIMIENTO', 'JEFE_PLANTA')
    )
  );

-- =====================================================
-- 4. STORAGE BUCKET POLICIES (diesel-evidence)
-- =====================================================

-- Policy: Anyone authenticated can view evidence
CREATE POLICY "Authenticated users can view diesel evidence"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'diesel-evidence'
    AND auth.role() = 'authenticated'
  );

-- Policy: Users can upload to diesel-evidence
CREATE POLICY "Authenticated users can upload diesel evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'diesel-evidence'
    AND auth.role() = 'authenticated'
  );

-- Policy: Users can update their own uploads (within 1 hour)
CREATE POLICY "Users can update own diesel evidence within 1h"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'diesel-evidence'
    AND owner = auth.uid()
    AND created_at > NOW() - INTERVAL '1 hour'
  );

-- Policy: Users can delete their own uploads (within 1 hour)
CREATE POLICY "Users can delete own diesel evidence within 1h"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'diesel-evidence'
    AND owner = auth.uid()
    AND created_at > NOW() - INTERVAL '1 hour'
  );

-- =====================================================
-- 5. HELPER FUNCTION: Check if user can access plant
-- =====================================================
CREATE OR REPLACE FUNCTION can_user_access_plant(p_user_id UUID, p_plant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles pr
    INNER JOIN plants p ON p.business_unit_id = pr.business_unit_id
    WHERE pr.id = p_user_id AND p.id = p_plant_id
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND plant_id = p_plant_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION can_user_access_plant(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION can_user_access_plant(UUID, UUID) IS 'Check if a user can access a specific plant (by business unit or direct assignment)';

-- =====================================================
-- RLS Policies Complete
-- =====================================================
-- Summary:
-- ✅ diesel_transactions: SELECT, INSERT, UPDATE policies by business unit and plant
-- ✅ diesel_evidence: SELECT, INSERT, DELETE policies with time restrictions
-- ✅ diesel_inventory_snapshots: SELECT, ALL policies for supervisors
-- ✅ storage.objects (diesel-evidence): SELECT, INSERT, UPDATE, DELETE policies
-- ✅ Helper function for plant access checking

