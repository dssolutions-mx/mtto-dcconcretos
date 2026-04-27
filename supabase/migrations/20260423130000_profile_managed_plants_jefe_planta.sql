-- Multi-plant Jefe de Planta: profile_managed_plants + profile_scoped_plant_ids().
-- RLS and asset plant helper updated to use the union of profiles.plant_id and junction rows.

-- ---------------------------------------------------------------------------
-- 1) Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_managed_plants (
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  plant_id uuid NOT NULL REFERENCES public.plants (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, plant_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_managed_plants_plant
  ON public.profile_managed_plants (plant_id);

COMMENT ON TABLE public.profile_managed_plants IS
  'Plants a profile may act on; union with profiles.plant_id. Used for JEFE_PLANTA multi-plant scope.';

ALTER TABLE public.profile_managed_plants ENABLE ROW LEVEL SECURITY;

-- Read: own row or elevated org roles
CREATE POLICY "profile_managed_plants_select"
  ON public.profile_managed_plants
  FOR SELECT
  TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY[
          'GERENCIA_GENERAL'::user_role,
          'GERENTE_MANTENIMIENTO'::user_role,
          'RECURSOS_HUMANOS'::user_role,
          'EJECUTIVO'::user_role,
          'AREA_ADMINISTRATIVA'::user_role
        ])
    )
  );

-- RH / GG (same set) may manage assignments for any profile
CREATE POLICY "profile_managed_plants_insert"
  ON public.profile_managed_plants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY[
          'GERENCIA_GENERAL'::user_role,
          'GERENTE_MANTENIMIENTO'::user_role,
          'RECURSOS_HUMANOS'::user_role,
          'EJECUTIVO'::user_role,
          'AREA_ADMINISTRATIVA'::user_role
        ])
    )
  );

CREATE POLICY "profile_managed_plants_update"
  ON public.profile_managed_plants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY[
          'GERENCIA_GENERAL'::user_role,
          'GERENTE_MANTENIMIENTO'::user_role,
          'RECURSOS_HUMANOS'::user_role,
          'EJECUTIVO'::user_role,
          'AREA_ADMINISTRATIVA'::user_role
        ])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY[
          'GERENCIA_GENERAL'::user_role,
          'GERENTE_MANTENIMIENTO'::user_role,
          'RECURSOS_HUMANOS'::user_role,
          'EJECUTIVO'::user_role,
          'AREA_ADMINISTRATIVA'::user_role
        ])
    )
  );

CREATE POLICY "profile_managed_plants_delete"
  ON public.profile_managed_plants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY[
          'GERENCIA_GENERAL'::user_role,
          'GERENTE_MANTENIMIENTO'::user_role,
          'RECURSOS_HUMANOS'::user_role,
          'EJECUTIVO'::user_role,
          'AREA_ADMINISTRATIVA'::user_role
        ])
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Scope helper (primary plant_id + junction, deduped)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profile_scoped_plant_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    array_agg(DISTINCT x) FILTER (WHERE x IS NOT NULL),
    ARRAY[]::uuid[]
  )
  FROM (
    SELECT pr.plant_id AS x
    FROM public.profiles pr
    WHERE pr.id = p_user_id
      AND pr.plant_id IS NOT NULL
    UNION ALL
    SELECT pmp.plant_id AS x
    FROM public.profile_managed_plants pmp
    WHERE pmp.profile_id = p_user_id
  ) s;
$function$;

COMMENT ON FUNCTION public.profile_scoped_plant_ids IS
  'Plants a user may act on: profiles.plant_id plus profile_managed_plants, deduplicated.';

-- ---------------------------------------------------------------------------
-- 3) Backfill: JEFE_PLANTA with a primary plant
-- ---------------------------------------------------------------------------
INSERT INTO public.profile_managed_plants (profile_id, plant_id)
SELECT p.id, p.plant_id
FROM public.profiles p
WHERE p.role = 'JEFE_PLANTA'::user_role
  AND p.plant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.profile_managed_plants m
    WHERE m.profile_id = p.id
      AND m.plant_id = p.plant_id
  );

-- Add second (or Nth) plant for a given JP in RH/Supabase: INSERT INTO profile_managed_plants
-- (Acceptance: mario.perez@dcconcretos.com.mx — use ops-confirmed second plant_id.)

-- RLS, user_can_update_asset_plant, user_plants_expanded: see 20260423130100_profile_managed_plants_rls_and_view.sql
