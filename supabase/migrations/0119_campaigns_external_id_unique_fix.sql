-- O índice parcial (where external_id is not null) da migration 0117 não pode
-- ser usado como alvo de ON CONFLICT sem repetir o predicado na query, o que
-- o supabase-js upsert não suporta — causava "there is no unique or exclusion
-- constraint matching the ON CONFLICT specification" na sincronização de
-- campanhas. NULLs já são tratados como distintos num índice único normal,
-- então remover o predicado é seguro para campanhas sem external_id.
drop index if exists public.campaigns_ad_account_external_id_key;

create unique index if not exists campaigns_ad_account_external_id_key
  on public.campaigns (ad_account_id, external_id);
