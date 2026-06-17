-- Portal de proveedores — membresía e invitaciones (Fase 1)
-- NO aplicar en producción sin revisión humana.

CREATE TABLE IF NOT EXISTS public.supplier_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  rfc text NOT NULL,
  mtto_supplier_id uuid REFERENCES public.suppliers (id) ON DELETE SET NULL,
  cotizador_group_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended')),
  invited_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_portal_users_auth_user_id_key UNIQUE (auth_user_id)
);

COMMENT ON TABLE public.supplier_portal_users IS
  'Membresía del portal externo de proveedores. Tenancy anclada por RFC; sin rol PROVEEDOR en profiles.';

COMMENT ON COLUMN public.supplier_portal_users.rfc IS
  'RFC fiscal unificador (mayúsculas, sin espacios).';

COMMENT ON COLUMN public.supplier_portal_users.cotizador_group_id IS
  'UUID del supplier_group en cotizador; sin FK cross-DB.';

CREATE INDEX IF NOT EXISTS idx_supplier_portal_users_rfc
  ON public.supplier_portal_users (rfc);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_portal_users_one_active_per_rfc
  ON public.supplier_portal_users (rfc)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_supplier_portal_users_mtto_supplier
  ON public.supplier_portal_users (mtto_supplier_id)
  WHERE mtto_supplier_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.supplier_portal_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  email text NOT NULL,
  rfc text NOT NULL,
  mtto_supplier_id uuid REFERENCES public.suppliers (id) ON DELETE SET NULL,
  invited_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_portal_invitations_token_key UNIQUE (token)
);

COMMENT ON TABLE public.supplier_portal_invitations IS
  'Tokens de invitación al portal de proveedores (un solo uso).';

CREATE INDEX IF NOT EXISTS idx_supplier_portal_invitations_email_pending
  ON public.supplier_portal_invitations (lower(email))
  WHERE accepted_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_supplier_portal_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_portal_users_updated_at ON public.supplier_portal_users;
CREATE TRIGGER trg_supplier_portal_users_updated_at
  BEFORE UPDATE ON public.supplier_portal_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_supplier_portal_users_updated_at();

ALTER TABLE public.supplier_portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_portal_invitations ENABLE ROW LEVEL SECURITY;

-- Proveedor: lee su propia membresía
CREATE POLICY supplier_portal_users_self_select ON public.supplier_portal_users
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Staff con permisos de padrón puede listar (lectura scoped; escrituras vía service role en API)
CREATE POLICY supplier_portal_users_staff_select ON public.supplier_portal_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'GERENCIA_GENERAL',
          'GERENTE_MANTENIMIENTO',
          'AREA_ADMINISTRATIVA',
          'COORDINADOR_MANTENIMIENTO',
          'ENCARGADO_MANTENIMIENTO',
          'AUXILIAR_COMPRAS'
        )
    )
  );

-- Invitaciones: solo staff de compras/admin puede leer pendientes
CREATE POLICY supplier_portal_invitations_staff_select ON public.supplier_portal_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'GERENCIA_GENERAL',
          'GERENTE_MANTENIMIENTO',
          'AREA_ADMINISTRATIVA',
          'COORDINADOR_MANTENIMIENTO',
          'ENCARGADO_MANTENIMIENTO',
          'AUXILIAR_COMPRAS'
        )
    )
  );
