-- Immutable audit trail for supplier verification / certification actions.
-- Aligns with suppliers UX modernization (verification panel + status transitions).

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id);

COMMENT ON COLUMN public.suppliers.verified_at IS 'Last time supplier was certified (active_certified); denormalized from supplier_verification_events';
COMMENT ON COLUMN public.suppliers.verified_by IS 'Profile that last certified this supplier';

CREATE TABLE IF NOT EXISTS public.supplier_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL,
  notes text,
  checklist_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_verification_events_supplier_id
  ON public.supplier_verification_events(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_verification_events_created_at
  ON public.supplier_verification_events(created_at DESC);

COMMENT ON TABLE public.supplier_verification_events IS 'Append-only audit log for supplier verification and status changes driven by review workflow';

ALTER TABLE public.supplier_verification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_verification_events_select_authenticated" ON public.supplier_verification_events;
DROP POLICY IF EXISTS "supplier_verification_events_insert_own_actor" ON public.supplier_verification_events;

CREATE POLICY "supplier_verification_events_select_authenticated"
  ON public.supplier_verification_events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "supplier_verification_events_insert_own_actor"
  ON public.supplier_verification_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

-- Atomic audit + supplier row update (called from API with user session)
CREATE OR REPLACE FUNCTION public.apply_supplier_verification_event(
  p_supplier_id uuid,
  p_action text,
  p_new_status text,
  p_notes text,
  p_checklist_snapshot jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.supplier_verification_events (
    supplier_id, actor_id, action, notes, checklist_snapshot
  ) VALUES (
    p_supplier_id, v_actor, p_action, p_notes, p_checklist_snapshot
  );

  UPDATE public.suppliers
  SET
    status = p_new_status,
    updated_at = now(),
    updated_by = v_actor,
    verified_at = CASE WHEN p_new_status = 'active_certified' THEN now() ELSE NULL END,
    verified_by = CASE WHEN p_new_status = 'active_certified' THEN v_actor ELSE NULL END
  WHERE id = p_supplier_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_supplier_verification_event(uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_supplier_verification_event(uuid, text, text, text, jsonb) TO authenticated;
