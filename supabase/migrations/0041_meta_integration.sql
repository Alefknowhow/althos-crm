-- Meta / Facebook Conversions API integration fields on organizations.
-- meta_pixel_id      : the Pixel dataset ID (visible, used client-side too)
-- meta_access_token  : System User token (server-side only, NEVER sent to browser)

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS meta_pixel_id     TEXT,
  ADD COLUMN IF NOT EXISTS meta_access_token TEXT;
