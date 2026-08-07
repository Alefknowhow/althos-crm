-- Colunas nullable pra guardar o breakdown de ações nativas da Meta
-- (leads, conversas de WhatsApp iniciadas, cliques em link, page views,
-- compras + valor) por dia/campanha, vindo de actions/action_values na
-- Insights API. Nullable e sem default pra não quebrar o importador CSV
-- (source='csv'), que continua sem preenchê-las.
ALTER TABLE campaign_metrics_daily
  ADD COLUMN IF NOT EXISTS meta_leads INTEGER,
  ADD COLUMN IF NOT EXISTS meta_messaging_started INTEGER,
  ADD COLUMN IF NOT EXISTS meta_link_clicks INTEGER,
  ADD COLUMN IF NOT EXISTS meta_landing_page_views INTEGER,
  ADD COLUMN IF NOT EXISTS meta_purchases INTEGER,
  ADD COLUMN IF NOT EXISTS meta_purchase_value_cents INTEGER;
