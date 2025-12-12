-- =====================================================
-- Fix RLS Policy for Asset Plant Unassignment
-- Migration: 20250115_fix_asset_unassignment_rls
-- Description: Allow authorized users to unassign assets from plants (set plant_id to NULL)
-- =====================================================

-- Drop the existing policy
DROP POLICY IF EXISTS "Assets hierarchical access - no recursion" ON "public"."assets";

-- Recreate the policy with updated WITH CHECK clause that handles NULL plant_id
-- The USING clause (for SELECT) remains unchanged
-- The WITH CHECK clause (for INSERT/UPDATE) is updated to allow NULL plant_id for authorized roles
CREATE POLICY "Assets hierarchical access - no recursion" ON "public"."assets" 
TO "authenticated" 
USING (
  -- GERENCIA_GENERAL: full access (plant_id IS NULL AND business_unit_id IS NULL)
  (EXISTS (
    SELECT 1 FROM "public"."profiles"
    WHERE ("profiles"."id" = "auth"."uid"()) 
    AND ("profiles"."plant_id" IS NULL) 
    AND ("profiles"."business_unit_id" IS NULL)
  ))
  OR
  -- JEFE_UNIDAD_NEGOCIO: access to assets in their business unit
  (EXISTS (
    SELECT 1 FROM ("public"."profiles" "p"
      JOIN "public"."plants" "pl" ON (("pl"."business_unit_id" = "p"."business_unit_id")))
    WHERE ("p"."id" = "auth"."uid"()) 
    AND ("p"."plant_id" IS NULL) 
    AND ("p"."business_unit_id" IS NOT NULL) 
    AND ("assets"."plant_id" = "pl"."id")
  ))
  OR
  -- JEFE_PLANTA/ENCARGADO_MANTENIMIENTO: access to assets in their plant
  (EXISTS (
    SELECT 1 FROM "public"."profiles"
    WHERE ("profiles"."id" = "auth"."uid"()) 
    AND ("profiles"."plant_id" = "assets"."plant_id")
  ))
)
WITH CHECK (
  -- GERENCIA_GENERAL: always allowed (plant_id IS NULL AND business_unit_id IS NULL)
  (EXISTS (
    SELECT 1 FROM "public"."profiles"
    WHERE ("profiles"."id" = "auth"."uid"()) 
    AND ("profiles"."plant_id" IS NULL) 
    AND ("profiles"."business_unit_id" IS NULL)
  ))
  OR
  -- JEFE_UNIDAD_NEGOCIO: allowed if NEW plant_id is NULL (unassigning) OR if NEW plant_id is in their business unit
  (EXISTS (
    SELECT 1 FROM ("public"."profiles" "p"
      JOIN "public"."plants" "pl" ON (("pl"."business_unit_id" = "p"."business_unit_id")))
    WHERE ("p"."id" = "auth"."uid"()) 
    AND ("p"."plant_id" IS NULL) 
    AND ("p"."business_unit_id" IS NOT NULL)
    AND (
      -- Allow unassigning (NULL plant_id) OR assigning to a plant in their business unit
      ("assets"."plant_id" IS NULL OR "assets"."plant_id" = "pl"."id")
    )
  ))
  OR
  -- JEFE_PLANTA/ENCARGADO_MANTENIMIENTO: allowed if NEW plant_id is NULL (unassigning) OR if NEW plant_id is their plant
  (EXISTS (
    SELECT 1 FROM "public"."profiles"
    WHERE ("profiles"."id" = "auth"."uid"()) 
    AND ("profiles"."plant_id" IS NOT NULL)
    AND (
      -- Allow unassigning (NULL plant_id) OR assigning to their plant
      ("assets"."plant_id" IS NULL OR "profiles"."plant_id" = "assets"."plant_id")
    )
    -- Only allow for roles that can manage asset assignments
    AND ("profiles"."role" IN ('JEFE_PLANTA'::"public"."user_role", 'ENCARGADO_MANTENIMIENTO'::"public"."user_role"))
  ))
);
