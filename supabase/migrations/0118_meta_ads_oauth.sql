-- Token de Anúncios (Meta Ads, escopo ads_read via OAuth do usuário) — separado
-- do meta_access_token usado pelo CAPI/Pixel (0041_meta_integration.sql), que é
-- um token de System User de longa duração e propósito diferente. Manter os
-- dois separados evita que a renovação de um sobrescreva o outro.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS meta_ads_access_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_ads_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_ads_connected_user_name TEXT;
