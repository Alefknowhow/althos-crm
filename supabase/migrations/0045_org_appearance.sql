-- Migration: org appearance (logo + primary color)
-- Adds logo_url and primary_color to organizations.
-- Creates the org-logos storage bucket with public read + member write policies.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS logo_url      TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT;   -- hex, e.g. "#4F46E5"

-- ── Storage bucket ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-logos',
  'org-logos',
  true,
  2097152,   -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Public read (logos are shown in the sidebar / header)
CREATE POLICY "org_logos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'org-logos');

-- Authenticated users can upload/replace/delete (path security enforced in app layer)
CREATE POLICY "org_logos_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'org-logos');

CREATE POLICY "org_logos_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'org-logos');

CREATE POLICY "org_logos_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'org-logos');
