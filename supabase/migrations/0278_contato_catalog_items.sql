-- Issue #21 (Catálogo) — "Uma Oportunidade pode selecionar um ou vários
-- itens [do Catálogo]" (fluxo Catálogo → Oportunidade/Proposta → Venda).
-- Não existia hoje nenhuma tabela ligando um contato/oportunidade a um item
-- estruturado de `products` — só o campo livre `contatos.value_cents`.
--
-- Snapshot de preço no momento em que o item foi adicionado à oportunidade
-- (unit_price_cents), pelo mesmo motivo que a issue exige pra Vendas:
-- mudar o preço no Catálogo depois não pode alterar o que já foi negociado.
-- A criação automática de Venda a partir desses itens ao ganhar o negócio
-- fica para a issue #20 (Vendas) — aqui só a seleção/precificação na
-- oportunidade em si.
create table if not exists public.contato_catalog_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  contato_id        uuid not null references public.contatos(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete restrict,
  quantity          integer not null default 1 check (quantity > 0),
  unit_price_cents  integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_contato_catalog_items_contato on public.contato_catalog_items(contato_id);
create index if not exists idx_contato_catalog_items_org on public.contato_catalog_items(organization_id);
create index if not exists idx_contato_catalog_items_product on public.contato_catalog_items(product_id);

drop trigger if exists update_contato_catalog_items_updated_at on public.contato_catalog_items;
create trigger update_contato_catalog_items_updated_at
before update on public.contato_catalog_items
for each row execute procedure update_updated_at_column();

alter table public.contato_catalog_items enable row level security;

create policy "org members access contato_catalog_items" on public.contato_catalog_items
  for all using (organization_id in (select get_user_organizations()));
