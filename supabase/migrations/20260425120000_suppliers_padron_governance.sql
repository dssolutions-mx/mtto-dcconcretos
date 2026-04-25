-- Suppliers padrón: RLS alignment with padron editors + Jefe UN scoped writes,
-- alias_of, optional name+BU uniqueness, indexes.
-- See lib/auth/role-permissions canManageSupplierPadron (TS) + SQL helpers below.

-- ---------------------------------------------------------------------------
-- 1) Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS alias_of uuid REFERENCES public.suppliers (id) ON DELETE SET NULL;

ALTER TABLE public.suppliers
  DROP CONSTRAINT IF EXISTS suppliers_alias_not_self;
ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_alias_not_self
  CHECK (alias_of IS NULL OR alias_of <> id);

CREATE INDEX IF NOT EXISTS idx_suppliers_alias_of ON public.suppliers (alias_of)
  WHERE alias_of IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Helper functions (STABLE, SECURITY DEFINER for policy readability)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_supplier_non_jefe_padron_editor(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_uid
      AND p.role IN (
        'GERENCIA_GENERAL',
        'GERENTE_MANTENIMIENTO',
        'AREA_ADMINISTRATIVA',
        'COORDINADOR_MANTENIMIENTO',
        'ENCARGADO_MANTENIMIENTO'
      )
  );
$$;

-- Padron list / detail: can see all supplier rows (incl. pending) for /suppliers UI
CREATE OR REPLACE FUNCTION public.is_supplier_padron_viewer(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    public.is_supplier_non_jefe_padron_editor(p_uid)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_uid
        AND p.role = 'JEFE_UNIDAD_NEGOCIO'
    );
$$;

CREATE OR REPLACE FUNCTION public.jefe_may_write_supplier(p_uid uuid, p_supplier_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.suppliers s ON s.id = p_supplier_id
    WHERE p.id = p_uid
      AND p.role = 'JEFE_UNIDAD_NEGOCIO'
      AND p.business_unit_id IS NOT NULL
      AND (
        s.business_unit_id = p.business_unit_id
        OR s.serves_all_business_units = true
        OR EXISTS (
          SELECT 1
          FROM public.supplier_business_units sbu
          WHERE sbu.supplier_id = s.id
            AND sbu.business_unit_id = p.business_unit_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.jefe_may_create_supplier(p_uid uuid, p_bu_id uuid, p_serves_all boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_uid
      AND p.role = 'JEFE_UNIDAD_NEGOCIO'
      AND p.business_unit_id IS NOT NULL
      AND (
        (p_bu_id IS NOT NULL AND p_bu_id = p.business_unit_id)
        OR coalesce(p_serves_all, false) = true
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.supplier_may_write(p_uid uuid, p_supplier_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.suppliers s
      WHERE s.id = p_supplier_id
        AND s.created_by = p_uid
    )
    OR public.is_supplier_non_jefe_padron_editor(p_uid)
    OR public.jefe_may_write_supplier(p_uid, p_supplier_id);
$$;

CREATE OR REPLACE FUNCTION public.supplier_insert_allowed(p_uid uuid, p_bu_id uuid, p_serves_all boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    public.is_supplier_non_jefe_padron_editor(p_uid)
    OR public.jefe_may_create_supplier(p_uid, p_bu_id, p_serves_all);
$$;

-- Jefe may only add/remove their own business_unit in supplier_business_units
CREATE OR REPLACE FUNCTION public.jefe_may_write_supplier_bu(
  p_uid uuid,
  p_supplier_id uuid,
  p_bu_to_write uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    public.is_supplier_non_jefe_padron_editor(p_uid)
    OR (
      public.jefe_may_write_supplier(p_uid, p_supplier_id)
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = p_uid
          AND p.role = 'JEFE_UNIDAD_NEGOCIO'
          AND p.business_unit_id = p_bu_to_write
      )
    );
$$;

COMMENT ON FUNCTION public.is_supplier_non_jefe_padron_editor(uuid) IS
  'Gerencia, Gerente Mtto, Admin, Coordinador, Encargado: full padrón write (non-Jefe UN).';
COMMENT ON FUNCTION public.supplier_may_write(uuid, uuid) IS
  'Creator, non-jefe padron, or scoped Jefe UN.';

-- ---------------------------------------------------------------------------
-- 3) Indexes for dedupe
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_suppliers_lower_btrim_name
  ON public.suppliers (lower(btrim((name)::text)));
CREATE INDEX IF NOT EXISTS idx_suppliers_tax_id_lower
  ON public.suppliers (lower(btrim((tax_id)::text)))
  WHERE tax_id IS NOT NULL AND btrim(tax_id::text) <> '';

-- ---------------------------------------------------------------------------
-- 4) (name, business_unit_id) uniqueness — drop legacy global name unique, add composite
-- ---------------------------------------------------------------------------
ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_name_unique;

-- Optional unique: only if no conflicting rows remain
DO $$
DECLARE
  dupes int;
BEGIN
  SELECT count(*)::int INTO dupes
  FROM (
    SELECT
      lower(btrim(s.name::text)) AS n,
      coalesce(s.business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid) AS b,
      count(*) AS c
    FROM public.suppliers s
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) t;

  IF dupes = 0 THEN
    DROP INDEX IF EXISTS public.uq_suppliers_name_bu_normalized;
    CREATE UNIQUE INDEX uq_suppliers_name_bu_normalized ON public.suppliers (
      lower(btrim((name)::text)),
      coalesce(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );
  ELSE
    RAISE NOTICE
      'suppliers_padron_governance: % duplicate (name, business_unit_id) group(s) — add suppliers_name_bu_unique manually after cleanup',
      dupes;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 5) RLS: suppliers
-- ---------------------------------------------------------------------------
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow view active suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow view own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow update own suppliers" ON public.suppliers;

CREATE POLICY "suppliers_select" ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (
    status IN ('active', 'active_certified')
    OR (status = 'pending' AND created_by = (SELECT auth.uid()))
    OR created_by = (SELECT auth.uid())
    OR public.is_supplier_padron_viewer((SELECT auth.uid()))
  );

CREATE POLICY "suppliers_insert" ON public.suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.supplier_insert_allowed(
      (SELECT auth.uid()),
      business_unit_id,
      serves_all_business_units
    )
  );

CREATE POLICY "suppliers_update" ON public.suppliers
  FOR UPDATE
  TO authenticated
  USING (public.supplier_may_write((SELECT auth.uid()), id))
  WITH CHECK (public.supplier_may_write((SELECT auth.uid()), id));

-- ---------------------------------------------------------------------------
-- 6) RLS: supplier_contacts
-- ---------------------------------------------------------------------------
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow view supplier contacts" ON public.supplier_contacts;
DROP POLICY IF EXISTS "Allow insert supplier contacts" ON public.supplier_contacts;

CREATE POLICY "supplier_contacts_select" ON public.supplier_contacts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.suppliers s
      WHERE s.id = supplier_contacts.supplier_id
        AND (
          s.status IN ('active', 'active_certified')
          OR s.created_by = (SELECT auth.uid())
          OR public.is_supplier_padron_viewer((SELECT auth.uid()))
        )
    )
  );

CREATE POLICY "supplier_contacts_insert" ON public.supplier_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.supplier_may_write((SELECT auth.uid()), supplier_id));

CREATE POLICY "supplier_contacts_update" ON public.supplier_contacts
  FOR UPDATE
  TO authenticated
  USING (public.supplier_may_write((SELECT auth.uid()), supplier_id))
  WITH CHECK (public.supplier_may_write((SELECT auth.uid()), supplier_id));

CREATE POLICY "supplier_contacts_delete" ON public.supplier_contacts
  FOR DELETE
  TO authenticated
  USING (public.supplier_may_write((SELECT auth.uid()), supplier_id));

-- ---------------------------------------------------------------------------
-- 7) RLS: supplier_business_units
-- ---------------------------------------------------------------------------
ALTER TABLE public.supplier_business_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_business_units_select" ON public.supplier_business_units;
DROP POLICY IF EXISTS "supplier_business_units_modify" ON public.supplier_business_units;

CREATE POLICY "supplier_business_units_select" ON public.supplier_business_units
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "supplier_business_units_insert" ON public.supplier_business_units
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.jefe_may_write_supplier_bu(
      (SELECT auth.uid()),
      supplier_id,
      business_unit_id
    )
  );

CREATE POLICY "supplier_business_units_update" ON public.supplier_business_units
  FOR UPDATE
  TO authenticated
  USING (public.supplier_may_write((SELECT auth.uid()), supplier_id))
  WITH CHECK (public.jefe_may_write_supplier_bu(
    (SELECT auth.uid()),
    supplier_id,
    business_unit_id
  ));

CREATE POLICY "supplier_business_units_delete" ON public.supplier_business_units
  FOR DELETE
  TO authenticated
  USING (public.jefe_may_write_supplier_bu(
    (SELECT auth.uid()),
    supplier_id,
    business_unit_id
  ));

-- ---------------------------------------------------------------------------
-- 8) RLS: supplier_services
-- ---------------------------------------------------------------------------
ALTER TABLE public.supplier_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow view supplier services" ON public.supplier_services;

CREATE POLICY "supplier_services_select" ON public.supplier_services
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_supplier_padron_viewer((SELECT auth.uid())));

CREATE POLICY "supplier_services_insert" ON public.supplier_services
  FOR INSERT
  TO authenticated
  WITH CHECK (public.supplier_may_write((SELECT auth.uid()), supplier_id));

CREATE POLICY "supplier_services_update" ON public.supplier_services
  FOR UPDATE
  TO authenticated
  USING (public.supplier_may_write((SELECT auth.uid()), supplier_id))
  WITH CHECK (public.supplier_may_write((SELECT auth.uid()), supplier_id));

CREATE POLICY "supplier_services_delete" ON public.supplier_services
  FOR DELETE
  TO authenticated
  USING (public.supplier_may_write((SELECT auth.uid()), supplier_id));

-- ---------------------------------------------------------------------------
-- 9) RLS: supplier_certifications
-- ---------------------------------------------------------------------------
ALTER TABLE public.supplier_certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow view supplier certifications" ON public.supplier_certifications;

CREATE POLICY "supplier_certifications_select" ON public.supplier_certifications
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_supplier_padron_viewer((SELECT auth.uid())));

CREATE POLICY "supplier_certifications_insert" ON public.supplier_certifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.supplier_may_write((SELECT auth.uid()), supplier_id));

CREATE POLICY "supplier_certifications_update" ON public.supplier_certifications
  FOR UPDATE
  TO authenticated
  USING (public.supplier_may_write((SELECT auth.uid()), supplier_id))
  WITH CHECK (public.supplier_may_write((SELECT auth.uid()), supplier_id));

CREATE POLICY "supplier_certifications_delete" ON public.supplier_certifications
  FOR DELETE
  TO authenticated
  USING (public.supplier_may_write((SELECT auth.uid()), supplier_id));

-- ---------------------------------------------------------------------------
-- 10) Grants (functions callable from RLS)
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.is_supplier_non_jefe_padron_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_supplier_padron_viewer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.jefe_may_write_supplier(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.jefe_may_create_supplier(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.jefe_may_write_supplier_bu(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_may_write(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_insert_allowed(uuid, uuid, boolean) TO authenticated;
