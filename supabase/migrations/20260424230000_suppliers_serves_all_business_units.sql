-- Global suppliers: visible in the padrón for every business unit / plant when true.
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS serves_all_business_units boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.suppliers.serves_all_business_units IS
  'When true, the supplier is included when filtering the padrón by any business_unit_id.';
