-- Picker de criativo do plano de mídia passa a apontar pra library_assets
-- (Biblioteca, #23) em vez de campaign_creatives (aba "Criativos" removida
-- da navegação). Coluna aditiva — creative_id não é removido (mantido por
-- compatibilidade; campaign_creatives em produção tem 0 linhas, confirmado
-- antes desta migration, então não há dado a migrar).

alter table public.media_plan_items
  add column library_asset_id uuid references library_assets(id) on delete set null;

create index idx_media_plan_items_library_asset on public.media_plan_items(library_asset_id);
