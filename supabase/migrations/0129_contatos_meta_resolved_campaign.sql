-- Fecha o elo de atribuição de CAC/ROAS pra WhatsApp: quando uma conversa
-- vem de um anúncio de Click-to-WhatsApp, o webhook resolve o ad_id do
-- referral pra um campaign_id local (via Graph API, ver
-- resolveAdCampaignExternalId em lib/meta/ads.ts) e grava aqui — evita
-- repetir a chamada à Meta a cada consulta do painel.
ALTER TABLE contatos
  ADD COLUMN IF NOT EXISTS meta_ad_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_resolved_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
