-- Bloco 3 — Email Pro:
--   • New columns on email_templates for categorization and source tracking
--   • Public Storage bucket `email-assets` for inline images, with org-scoped
--     RLS so each org can only read/write under its own prefix
--
-- The bucket is created via storage.buckets, which is the Supabase-recommended
-- way (works in self-hosted and cloud). RLS policies on storage.objects gate
-- read/write per organization_id (encoded as the first path segment).

-- 1) email_templates extras
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS seed_key TEXT;

CREATE INDEX IF NOT EXISTS idx_email_templates_org_category
  ON email_templates (organization_id, category);

-- 2) Storage bucket for email images. Public so the URLs work inside emails
-- without requiring the recipient to be authenticated.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-assets',
  'email-assets',
  TRUE,
  10 * 1024 * 1024, -- 10 MB cap per file
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3) RLS for storage.objects in this bucket. Path layout: <org_id>/<filename>
-- Members of the org can write under their org's prefix; anyone can read
-- (since the bucket is public — readability works without auth, but we still
-- declare the SELECT policy for clarity).
DROP POLICY IF EXISTS "Email assets read public" ON storage.objects;
CREATE POLICY "Email assets read public"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');

DROP POLICY IF EXISTS "Email assets write own org" ON storage.objects;
CREATE POLICY "Email assets write own org"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'email-assets'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Email assets update own org" ON storage.objects;
CREATE POLICY "Email assets update own org"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'email-assets'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Email assets delete own org" ON storage.objects;
CREATE POLICY "Email assets delete own org"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'email-assets'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);
