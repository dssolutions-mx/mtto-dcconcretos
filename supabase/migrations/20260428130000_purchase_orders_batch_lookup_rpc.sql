-- Work orders list API: avoid GET query-string limits when filtering purchase_orders
-- with huge .in() lists (PostgREST encodes filters in the URL → 400 from gateway).

CREATE OR REPLACE FUNCTION public.purchase_orders_by_work_order_ids(p_work_order_ids uuid[])
RETURNS TABLE (
  id uuid,
  order_id text,
  status text,
  work_order_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    po.id,
    po.order_id::text,
    po.status::text,
    po.work_order_id
  FROM public.purchase_orders po
  WHERE po.work_order_id IS NOT NULL
    AND po.work_order_id = ANY (p_work_order_ids);
$$;

COMMENT ON FUNCTION public.purchase_orders_by_work_order_ids(uuid[]) IS
  'Purchase orders linked to given work_order ids; invoked via RPC POST body so large id sets do not exceed URL limits. RLS applies.';

CREATE OR REPLACE FUNCTION public.purchase_orders_id_status_by_ids(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  status text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    po.id,
    po.status::text
  FROM public.purchase_orders po
  WHERE po.id = ANY (p_ids);
$$;

COMMENT ON FUNCTION public.purchase_orders_id_status_by_ids(uuid[]) IS
  'Id and status for purchase orders in a given id set; batched lookup without giant REST filter URLs. RLS applies.';

GRANT EXECUTE ON FUNCTION public.purchase_orders_by_work_order_ids(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_orders_id_status_by_ids(uuid[]) TO authenticated;
