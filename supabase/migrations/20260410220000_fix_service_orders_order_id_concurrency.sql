-- Fix duplicate service_orders.order_id under concurrency:
-- - set_order_id used COUNT(*)+1 (unsafe; produced OT- prefix)
-- - set_service_order_id used generate_next_id (read-max then increment; still racy)
-- Keep a single BEFORE INSERT trigger: trg_generate_service_order_id -> sequence-backed IDs.
-- Production rows use OT-; align prefix and bump sequence past max(OT-*, OS-*).

DROP TRIGGER IF EXISTS set_order_id ON public.service_orders;
DROP TRIGGER IF EXISTS set_service_order_id_trigger ON public.service_orders;

CREATE OR REPLACE FUNCTION public.generate_service_order_id_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.order_id IS NULL OR NEW.order_id = '' THEN
    NEW.order_id := 'OT-' || LPAD(nextval('public.service_orders_order_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

SELECT setval(
  'public.service_orders_order_number_seq',
  GREATEST(
    (SELECT COALESCE(MAX((SUBSTRING(order_id FROM '[0-9]+'))::int), 0)
     FROM public.service_orders
     WHERE order_id ~ '^OT-[0-9]+$'),
    (SELECT COALESCE(MAX((SUBSTRING(order_id FROM '[0-9]+'))::int), 0)
     FROM public.service_orders
     WHERE order_id ~ '^OS-[0-9]+$'),
    (SELECT last_value FROM public.service_orders_order_number_seq)
  ),
  true
);
