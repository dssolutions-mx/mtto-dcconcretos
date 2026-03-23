-- Add GERENTE_MANTENIMIENTO and COORDINADOR_MANTENIMIENTO to all RLS policies
-- GERENTE_MANTENIMIENTO has global scope (same as GERENCIA_GENERAL) - access to everything
-- COORDINADOR_MANTENIMIENTO has plant/unit scope (same as ENCARGADO_MANTENIMIENTO)
-- Migration: 20260309_add_gerente_mantenimiento_full_rls_access

-- 1. APP_SETTINGS
DROP POLICY IF EXISTS "Admin read app_settings" ON app_settings;
CREATE POLICY "Admin read app_settings" ON app_settings FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])));

DROP POLICY IF EXISTS "Admin write app_settings" ON app_settings;
CREATE POLICY "Admin write app_settings" ON app_settings FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])));

-- 2. ASSET_ACCOUNTABILITY_TRACKING
DROP POLICY IF EXISTS "Users can view asset accountability in scope" ON asset_accountability_tracking;
CREATE POLICY "Users can view asset accountability in scope" ON asset_accountability_tracking FOR SELECT
USING (EXISTS (
  SELECT 1 FROM assets a
  JOIN profiles p ON p.id = auth.uid()
  WHERE a.id = asset_accountability_tracking.asset_id
    AND (
      a.plant_id = p.plant_id
      OR p.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])
      OR (p.role IN ('JEFE_UNIDAD_NEGOCIO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role)
          AND EXISTS (SELECT 1 FROM plants pl WHERE pl.id = a.plant_id AND pl.business_unit_id = p.business_unit_id))
    )
));

-- 3. ASSET_ASSIGNMENT_HISTORY
DROP POLICY IF EXISTS "Users can view asset assignment history based on role" ON asset_assignment_history;
CREATE POLICY "Users can view asset assignment history based on role" ON asset_assignment_history FOR SELECT
USING (auth.uid() IN (
  SELECT profiles.id FROM profiles
  WHERE (profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'GERENTE_MANTENIMIENTO'::user_role]))
    OR (profiles.role IN ('JEFE_UNIDAD_NEGOCIO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role)
        AND profiles.business_unit_id IN (SELECT plants.business_unit_id FROM plants
          WHERE plants.id = asset_assignment_history.new_plant_id OR plants.id = asset_assignment_history.previous_plant_id))
    OR (profiles.role = 'JEFE_PLANTA'::user_role AND profiles.plant_id = ANY (ARRAY[asset_assignment_history.new_plant_id, asset_assignment_history.previous_plant_id]))
    OR (profiles.role IN ('ENCARGADO_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role)
        AND profiles.plant_id = ANY (ARRAY[asset_assignment_history.new_plant_id, asset_assignment_history.previous_plant_id]))
));

-- 4. ASSET_COMPOSITE_RELATIONSHIPS
DROP POLICY IF EXISTS "Users can manage composite relationships in their scope" ON asset_composite_relationships;
CREATE POLICY "Users can manage composite relationships in their scope" ON asset_composite_relationships FOR ALL
USING (
  (EXISTS (SELECT 1 FROM profiles p JOIN assets a_comp ON a_comp.id = asset_composite_relationships.composite_asset_id
    WHERE p.id = auth.uid() AND (p.plant_id = a_comp.plant_id OR p.role = 'GERENCIA_GENERAL'::user_role OR p.role = 'GERENTE_MANTENIMIENTO'::user_role
      OR (p.role = 'JEFE_UNIDAD_NEGOCIO'::user_role AND p.business_unit_id = (SELECT plants.business_unit_id FROM plants WHERE plants.id = a_comp.plant_id))
      OR (p.role IN ('JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role) AND p.plant_id = a_comp.plant_id))))
  AND (EXISTS (SELECT 1 FROM profiles p2 JOIN assets a_component ON a_component.id = asset_composite_relationships.component_asset_id
    WHERE p2.id = auth.uid() AND (
      p2.plant_id = a_component.plant_id
      OR p2.role = 'GERENCIA_GENERAL'::user_role
      OR p2.role = 'GERENTE_MANTENIMIENTO'::user_role
      OR (p2.role = 'JEFE_UNIDAD_NEGOCIO'::user_role AND p2.business_unit_id = (SELECT plants.business_unit_id FROM plants WHERE plants.id = a_component.plant_id))
      OR (p2.role IN ('JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role) AND p2.plant_id = a_component.plant_id)
    )))
);

DROP POLICY IF EXISTS "Users can view composite relationships in their scope" ON asset_composite_relationships;
CREATE POLICY "Users can view composite relationships in their scope" ON asset_composite_relationships FOR SELECT
USING (
  (EXISTS (SELECT 1 FROM profiles p JOIN assets a_comp ON a_comp.id = asset_composite_relationships.composite_asset_id
    WHERE p.id = auth.uid() AND (p.plant_id = a_comp.plant_id OR p.role = 'GERENCIA_GENERAL'::user_role OR p.role = 'GERENTE_MANTENIMIENTO'::user_role
      OR (p.role = 'JEFE_UNIDAD_NEGOCIO'::user_role AND p.business_unit_id = (SELECT plants.business_unit_id FROM plants WHERE plants.id = a_comp.plant_id))
      OR (p.role IN ('JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role) AND p.plant_id = a_comp.plant_id))))
  AND (EXISTS (SELECT 1 FROM profiles p2 JOIN assets a_component ON a_component.id = asset_composite_relationships.component_asset_id
    WHERE p2.id = auth.uid() AND (
      p2.plant_id = a_component.plant_id
      OR p2.role = 'GERENCIA_GENERAL'::user_role
      OR p2.role = 'GERENTE_MANTENIMIENTO'::user_role
      OR (p2.role = 'JEFE_UNIDAD_NEGOCIO'::user_role AND p2.business_unit_id = (SELECT plants.business_unit_id FROM plants WHERE plants.id = a_component.plant_id))
      OR (p2.role IN ('JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role) AND p2.plant_id = a_component.plant_id)
    )))
);

-- 5. AUTHORIZATION_MATRIX
DROP POLICY IF EXISTS "Authorization matrix administrative access" ON authorization_matrix;
CREATE POLICY "Authorization matrix administrative access" ON authorization_matrix FOR ALL
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
  AND p.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])
  AND p.status = 'active'));

-- 6. BUSINESS_UNIT_LIMITS
DROP POLICY IF EXISTS "manage_business_unit_limits" ON business_unit_limits;
CREATE POLICY "manage_business_unit_limits" ON business_unit_limits FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])));

DROP POLICY IF EXISTS "view_business_unit_limits" ON business_unit_limits;
CREATE POLICY "view_business_unit_limits" ON business_unit_limits FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])));

-- 7. COMPLIANCE_DISPUTE_HISTORY
DROP POLICY IF EXISTS "Users can view dispute history for their incidents" ON compliance_dispute_history;
CREATE POLICY "Users can view dispute history for their incidents" ON compliance_dispute_history FOR SELECT
USING (
  (EXISTS (SELECT 1 FROM compliance_incidents ci WHERE ci.id = compliance_dispute_history.incident_id AND ci.user_id = auth.uid()))
  OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    AND p.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'JEFE_PLANTA'::user_role, 'AREA_ADMINISTRATIVA'::user_role,
      'ENCARGADO_MANTENIMIENTO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])))
);

-- 8. COMPLIANCE_INCIDENTS
DROP POLICY IF EXISTS "Users can view relevant compliance incidents" ON compliance_incidents;
CREATE POLICY "Users can view relevant compliance incidents" ON compliance_incidents FOR SELECT
USING (
  (user_id = auth.uid())
  OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    AND (p.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'JEFE_PLANTA'::user_role,
      'ENCARGADO_MANTENIMIENTO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])
      OR (compliance_incidents.asset_id IS NOT NULL AND EXISTS (SELECT 1 FROM assets a
          WHERE a.id = compliance_incidents.asset_id AND a.plant_id = p.plant_id)))))
);

-- 9. INVENTORY_WAREHOUSES
DROP POLICY IF EXISTS "Supervisors update warehouses in accessible plants" ON inventory_warehouses;
CREATE POLICY "Supervisors update warehouses in accessible plants" ON inventory_warehouses FOR UPDATE
USING (
  (EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid()
    AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role,
      'JEFE_PLANTA'::user_role, 'GERENTE_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])
    AND pr.status = 'active'))
  AND (plant_id IN (SELECT p.id FROM plants p
    WHERE p.id IN (SELECT plant_id FROM profiles WHERE id = auth.uid())
      OR p.business_unit_id IN (SELECT business_unit_id FROM profiles WHERE id = auth.uid() AND plant_id IS NULL
        AND role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role]))
      OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
        AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'GERENTE_MANTENIMIENTO'::user_role]))))
);

DROP POLICY IF EXISTS "Users can view warehouses for their plants" ON inventory_warehouses;
CREATE POLICY "Users can view warehouses for their plants" ON inventory_warehouses FOR SELECT
USING (plant_id IN (
  SELECT p.id FROM plants p
  WHERE p.id IN (SELECT plant_id FROM profiles WHERE id = auth.uid())
    OR p.business_unit_id IN (SELECT business_unit_id FROM profiles WHERE id = auth.uid() AND plant_id IS NULL
      AND role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role]))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
      AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'GERENTE_MANTENIMIENTO'::user_role]))
));

-- 10. MANUAL_FINANCIAL_ADJUSTMENT_DISTRIBUTIONS
DROP POLICY IF EXISTS "Admin and Gerente can view manual_financial_adjustment_distribu" ON manual_financial_adjustment_distributions;
CREATE POLICY "Admin and Gerente can view manual_financial_adjustment_distribu" ON manual_financial_adjustment_distributions FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])
  AND EXISTS (SELECT 1 FROM manual_financial_adjustments WHERE manual_financial_adjustments.id = manual_financial_adjustment_distributions.adjustment_id)));

DROP POLICY IF EXISTS "Admin and RH can update manual_financial_adjustment_distributio" ON manual_financial_adjustment_distributions;
CREATE POLICY "Admin and RH can update manual_financial_adjustment_distributio" ON manual_financial_adjustment_distributions FOR UPDATE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND (profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])
    OR (profiles.role = 'AREA_ADMINISTRATIVA'::user_role AND EXISTS (SELECT 1 FROM manual_financial_adjustments
        WHERE manual_financial_adjustments.id = manual_financial_adjustment_distributions.adjustment_id
          AND manual_financial_adjustments.created_by = auth.uid())))));

DROP POLICY IF EXISTS "Admin can delete manual_financial_adjustment_distributions" ON manual_financial_adjustment_distributions;
CREATE POLICY "Admin can delete manual_financial_adjustment_distributions" ON manual_financial_adjustment_distributions FOR DELETE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])));

-- 11. MANUAL_FINANCIAL_ADJUSTMENTS
DROP POLICY IF EXISTS "Admin and Gerente can view manual_financial_adjustments" ON manual_financial_adjustments;
CREATE POLICY "Admin and Gerente can view manual_financial_adjustments" ON manual_financial_adjustments FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])));

DROP POLICY IF EXISTS "Admin and RH can update manual_financial_adjustments" ON manual_financial_adjustments;
CREATE POLICY "Admin and RH can update manual_financial_adjustments" ON manual_financial_adjustments FOR UPDATE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND (profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])
    OR (profiles.role = 'AREA_ADMINISTRATIVA'::user_role AND manual_financial_adjustments.created_by = auth.uid()))));

DROP POLICY IF EXISTS "Admin can delete manual_financial_adjustments" ON manual_financial_adjustments;
CREATE POLICY "Admin can delete manual_financial_adjustments" ON manual_financial_adjustments FOR DELETE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])));

-- 12. OPERATOR_ASSIGNMENT_HISTORY
DROP POLICY IF EXISTS "Users can view operator assignment history in their scope" ON operator_assignment_history;
CREATE POLICY "Users can view operator assignment history in their scope" ON operator_assignment_history FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles p
  JOIN assets a ON a.id = operator_assignment_history.asset_id
  WHERE p.id = auth.uid()
    AND (p.plant_id = a.plant_id
      OR p.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])
      OR (p.role = 'JEFE_UNIDAD_NEGOCIO'::user_role AND p.business_unit_id = (SELECT plants.business_unit_id FROM plants WHERE plants.id = a.plant_id)))
));

-- 13. SANCTIONS
DROP POLICY IF EXISTS "Managers can view sanctions in scope" ON sanctions;
CREATE POLICY "Managers can view sanctions in scope" ON sanctions FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
  AND p.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'JEFE_PLANTA'::user_role,
    'ENCARGADO_MANTENIMIENTO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])));

-- 14. SYSTEM_SETTINGS
DROP POLICY IF EXISTS "Admins can manage system settings" ON system_settings;
CREATE POLICY "Admins can manage system settings" ON system_settings FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])));

DROP POLICY IF EXISTS "Admins can update system settings" ON system_settings;
CREATE POLICY "Admins can update system settings" ON system_settings FOR UPDATE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])));

-- 15. SYSTEM_SETTINGS_AUDIT_LOG
DROP POLICY IF EXISTS "Admins can view settings audit log" ON system_settings_audit_log;
CREATE POLICY "Admins can view settings audit log" ON system_settings_audit_log FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
  AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])));

-- 16. UNIT_CONVERSIONS
DROP POLICY IF EXISTS "Admins manage unit conversions" ON unit_conversions;
CREATE POLICY "Admins manage unit conversions" ON unit_conversions FOR ALL
USING (EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid()
  AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])
  AND pr.status = 'active'));
