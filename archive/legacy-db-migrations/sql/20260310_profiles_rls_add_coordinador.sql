-- Add COORDINADOR_MANTENIMIENTO to Profiles hierarchical administration policy
-- The policy allows ENCARGADO_MANTENIMIENTO to manage OPERADOR/DOSIFICADOR in their scope.
-- COORDINADOR_MANTENIMIENTO replaces Encargado; add it for parity.
-- Migration: 20260310_profiles_rls_add_coordinador

-- The Profiles hierarchical administration policy includes a branch:
-- uac.user_role = 'ENCARGADO_MANTENIMIENTO' for managing OPERADOR/DOSIFICADOR.
-- We need to include COORDINADOR_MANTENIMIENTO as well.

-- Drop existing policy
DROP POLICY IF EXISTS "Profiles hierarchical administration" ON profiles;

-- Recreate with COORDINADOR_MANTENIMIENTO included in the ENCARGADO branch
-- (user_role = ANY (ARRAY['ENCARGADO_MANTENIMIENTO', 'COORDINADOR_MANTENIMIENTO']))
CREATE POLICY "Profiles hierarchical administration" ON profiles TO authenticated
USING (
  (id = auth.uid())
  OR (EXISTS (
    SELECT 1 FROM user_admin_context
    WHERE user_admin_context.user_id = auth.uid() AND user_admin_context.admin_level = 'TOTAL'
  ))
  OR (EXISTS (
    SELECT 1 FROM user_admin_context uac
    WHERE uac.user_id = auth.uid() AND uac.admin_level = 'UNIT'
      AND (profiles.business_unit_id = uac.business_unit_id
        OR profiles.plant_id IN (SELECT id FROM plants WHERE business_unit_id = uac.business_unit_id))
  ))
  OR (EXISTS (
    SELECT 1 FROM user_admin_context uac
    WHERE uac.user_id = auth.uid() AND uac.admin_level = 'PLANT' AND profiles.plant_id = uac.plant_id
  ))
  OR (EXISTS (
    SELECT 1 FROM user_admin_context uac
    WHERE uac.user_id = auth.uid()
      AND uac.user_role = ANY (ARRAY['ENCARGADO_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])
      AND profiles.role = ANY (ARRAY['OPERADOR'::user_role, 'DOSIFICADOR'::user_role])
      AND ((uac.admin_level = 'UNIT' AND profiles.business_unit_id = uac.business_unit_id)
        OR (uac.admin_level = 'PLANT' AND profiles.plant_id = uac.plant_id)
        OR uac.admin_level = 'TOTAL')
  ))
) WITH CHECK (
  (id = auth.uid())
  OR (EXISTS (
    SELECT 1 FROM user_admin_context
    WHERE user_admin_context.user_id = auth.uid() AND user_admin_context.admin_level = 'TOTAL'
  ))
  OR (EXISTS (
    SELECT 1 FROM user_admin_context uac
    WHERE uac.user_id = auth.uid() AND uac.admin_level = 'UNIT'
      AND (profiles.business_unit_id = uac.business_unit_id
        OR profiles.plant_id IN (SELECT id FROM plants WHERE business_unit_id = uac.business_unit_id))
  ))
  OR (EXISTS (
    SELECT 1 FROM user_admin_context uac
    WHERE uac.user_id = auth.uid() AND uac.admin_level = 'PLANT' AND profiles.plant_id = uac.plant_id
  ))
);
