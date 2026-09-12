-- Rastreamento do Google (Google Ads Tag + rótulo de conversão) por
-- pipeline — mesmo espírito do Pixel/CAPI da Meta (migration 0240),
-- client-side apenas (sem Google Ads API/OAuth server-side).
alter table pipelines
  add column if not exists google_ads_id text,
  add column if not exists google_ads_conversion_label text;
