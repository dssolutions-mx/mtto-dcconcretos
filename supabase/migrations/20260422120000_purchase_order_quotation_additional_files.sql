-- Extra quotation attachments in storage bucket "quotations"
-- Primary file remains in file_storage_path / file_name; extras stored as JSONB array.
ALTER TABLE public.purchase_order_quotations
  ADD COLUMN IF NOT EXISTS additional_files jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.purchase_order_quotations.additional_files IS
  'Array of { "file_storage_path", "file_name" } for extra quote files in the quotations bucket.';
