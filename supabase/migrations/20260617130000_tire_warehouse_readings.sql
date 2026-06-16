-- Allow baseline tread/pressure readings for tires still in warehouse (no mount yet).

ALTER TABLE public.tire_readings
  ALTER COLUMN installation_id DROP NOT NULL,
  ALTER COLUMN asset_id DROP NOT NULL;

ALTER TABLE public.tire_readings
  ADD CONSTRAINT tire_readings_mount_context_check
  CHECK (
    (installation_id IS NOT NULL AND asset_id IS NOT NULL)
    OR (installation_id IS NULL AND asset_id IS NULL)
  );

COMMENT ON CONSTRAINT tire_readings_mount_context_check ON public.tire_readings IS
  'Mounted readings require installation + asset; warehouse baseline readings use tire_id only.';
