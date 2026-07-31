-- Permite upsert de campanhas sincronizadas automaticamente da Meta Marketing
-- API por (ad_account_id, external_id), sem duplicar a cada sincronização.
create unique index if not exists campaigns_ad_account_external_id_key
  on public.campaigns (ad_account_id, external_id)
  where external_id is not null;
