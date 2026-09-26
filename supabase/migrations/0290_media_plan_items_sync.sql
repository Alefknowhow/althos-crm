-- Sincronização Estratégia (Althos) × publicado na plataforma (#22, passo 3.5).
alter table media_plan_items
    add column if not exists external_id text,
    add column if not exists external_provider text check (external_provider in ('meta', 'google')),
    add column if not exists sync_status text not null default 'draft' check (sync_status in ('draft', 'published', 'diverged', 'sync_error', 'external_change')),
    add column if not exists last_synced_at timestamptz,
    add column if not exists last_sync_error text;

create index if not exists idx_media_plan_items_external on media_plan_items (external_provider, external_id) where external_id is not null;
