-- Bucket for asset insurance / general documents (client uploads from asset edit / offline sync).
-- Safe to run multiple times.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'asset-documents',
  'asset-documents',
  true,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read (getPublicUrl) and authenticated uploads/updates/deletes for this bucket.
DROP POLICY IF EXISTS "asset_documents_select_public" ON storage.objects;
CREATE POLICY "asset_documents_select_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'asset-documents');

DROP POLICY IF EXISTS "asset_documents_insert_authenticated" ON storage.objects;
CREATE POLICY "asset_documents_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'asset-documents');

DROP POLICY IF EXISTS "asset_documents_update_authenticated" ON storage.objects;
CREATE POLICY "asset_documents_update_authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'asset-documents')
WITH CHECK (bucket_id = 'asset-documents');

DROP POLICY IF EXISTS "asset_documents_delete_authenticated" ON storage.objects;
CREATE POLICY "asset_documents_delete_authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'asset-documents');
