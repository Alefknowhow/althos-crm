-- form-assets bucket only allowed images (5 MB) since 0043, but Reservas'
-- voucher upload (actions/upload.ts) accepts PDFs up to 15 MB into this
-- same bucket, which Supabase Storage was rejecting at the bucket level
-- with "mime type application/pdf is not supported".

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','application/pdf'],
  file_size_limit = 15728640 -- 15 MB
WHERE id = 'form-assets';
