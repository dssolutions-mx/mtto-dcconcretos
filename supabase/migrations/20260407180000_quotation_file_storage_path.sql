-- Stable storage path for quotation files (private bucket); signed URLs are minted at read time.
ALTER TABLE public.purchase_order_quotations
  ADD COLUMN IF NOT EXISTS file_storage_path TEXT;

COMMENT ON COLUMN public.purchase_order_quotations.file_storage_path IS
  'Path within storage bucket quotations/; preferred over persisting signed URLs in file_url.';

-- Backfill from legacy signed URLs where parseable (path segment before ?token=)
UPDATE public.purchase_order_quotations
SET file_storage_path = (regexp_match(file_url, '/object/sign/quotations/([^?]+)'))[1]
WHERE file_storage_path IS NULL
  AND file_url IS NOT NULL
  AND file_url LIKE '%/object/sign/quotations/%';
