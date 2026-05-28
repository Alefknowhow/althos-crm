-- Public Storage bucket for images attached to form questions and
-- the form footer signature. Public so anonymous visitors can load
-- the images while filling out the form.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-assets',
  'form-assets',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (forms are public pages)
DROP POLICY IF EXISTS "Form assets read public" ON storage.objects;
CREATE POLICY "Form assets read public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'form-assets');

-- Authenticated users may only write inside their own org's folder
-- Path layout: <org_id>/<timestamp>-<random>.<ext>
DROP POLICY IF EXISTS "Form assets insert own org" ON storage.objects;
CREATE POLICY "Form assets insert own org"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'form-assets'
    AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
  );

DROP POLICY IF EXISTS "Form assets delete own org" ON storage.objects;
CREATE POLICY "Form assets delete own org"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'form-assets'
    AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
  );
