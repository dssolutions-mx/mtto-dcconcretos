-- Fix duplicate work_orders.order_id (23505) when creating corrective orders from checklists.
--
-- Symptoms: PostgREST INSERT into work_orders fails with
--   duplicate key value violates unique constraint "work_orders_order_id_key"
-- especially when generate-corrective-work-order-enhanced creates multiple orders per checklist.
--
-- Root causes:
-- 1) work_order_id_seq drifted ahead while still emitting IDs in ranges that already exist
--    (e.g. OT-1698) because nextval is not rolled back on failed inserts.
-- 2) Under connection pooling, advisory locks may not fully serialize concurrent ID generation.
--
-- Fix: allocate from MAX(existing OT-####)+1 under advisory lock, keep sequence in sync,
-- and make the trigger loop until a free ID is found.

CREATE OR REPLACE FUNCTION public.generate_unique_work_order_id()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  v_n bigint;
  v_id text;
  v_guard int := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(123456789);

  SELECT COALESCE(MAX((SUBSTRING(order_id FROM 4))::integer), 0) + 1
  INTO v_n
  FROM public.work_orders
  WHERE order_id ~ '^OT-[0-9]+$';

  LOOP
    v_id := 'OT-' || LPAD(v_n::text, 4, '0');

    IF NOT EXISTS (
      SELECT 1 FROM public.work_orders WHERE order_id = v_id
    ) THEN
      PERFORM setval('public.work_order_id_seq', v_n, true);
      RETURN v_id;
    END IF;

    v_n := v_n + 1;
    v_guard := v_guard + 1;

    IF v_guard > 200 THEN
      v_id := 'OT-' || TO_CHAR(EXTRACT(EPOCH FROM clock_timestamp()), 'FM00000000')
        || '-' || LPAD((random() * 99999)::int::text, 5, '0');
      RETURN v_id;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_work_order_id_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_generated_id text;
  v_retry_count int := 0;
  v_max_retries int := 8;
BEGIN
  IF NEW.order_id IS NOT NULL AND NEW.order_id <> '' THEN
    IF EXISTS (
      SELECT 1
      FROM public.work_orders
      WHERE order_id = NEW.order_id
        AND id IS DISTINCT FROM COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'El order_id % ya existe', NEW.order_id;
    END IF;
    RETURN NEW;
  END IF;

  LOOP
    v_generated_id := public.generate_unique_work_order_id();

    IF NOT EXISTS (
      SELECT 1 FROM public.work_orders WHERE order_id = v_generated_id
    ) THEN
      NEW.order_id := v_generated_id;
      RETURN NEW;
    END IF;

    v_retry_count := v_retry_count + 1;
    IF v_retry_count >= v_max_retries THEN
      NEW.order_id := 'OT-' || TO_CHAR(EXTRACT(EPOCH FROM clock_timestamp()), 'FM00000000')
        || '-' || LPAD((random() * 99999)::int::text, 5, '0');
      RETURN NEW;
    END IF;
  END LOOP;
END;
$function$;

DROP TRIGGER IF EXISTS trg_generate_work_order_id ON public.work_orders;
CREATE TRIGGER trg_generate_work_order_id
  BEFORE INSERT ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_work_order_id_trigger();

-- Resync sequence to the highest existing OT-#### id (or current seq, whichever is larger).
SELECT setval(
  'public.work_order_id_seq',
  GREATEST(
    (
      SELECT COALESCE(MAX((SUBSTRING(order_id FROM 4))::integer), 0)
      FROM public.work_orders
      WHERE order_id ~ '^OT-[0-9]+$'
    ),
    (SELECT last_value FROM public.work_order_id_seq)
  ),
  true
);

GRANT EXECUTE ON FUNCTION public.generate_unique_work_order_id() TO anon;
GRANT EXECUTE ON FUNCTION public.generate_unique_work_order_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_work_order_id() TO service_role;
