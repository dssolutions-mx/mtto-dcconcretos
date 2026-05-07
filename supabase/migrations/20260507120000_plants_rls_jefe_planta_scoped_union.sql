-- Multi-plant JEFE_PLANTA: "Plants hierarchical access" only allowed profiles.plant_id = plants.id,
-- so extra plants in profile_managed_plants were invisible to RLS. user_plants_expanded JOIN then
-- failed to resolve names; direct .from('plants').in('id', …) also dropped rows.

DROP POLICY IF EXISTS "Plants hierarchical access" ON public.plants;

CREATE POLICY "Plants hierarchical access" ON public.plants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.plant_id IS NULL
        AND profiles.business_unit_id IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.plant_id IS NULL
        AND profiles.business_unit_id = plants.business_unit_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.plant_id = plants.id
    )
    OR plants.id = ANY (public.profile_scoped_plant_ids(auth.uid()))
  );
