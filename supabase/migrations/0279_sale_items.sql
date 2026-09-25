-- Issue #20 (Vendas) — "Uma Venda pode possuir múltiplos itens do Catálogo"
-- + "preservar um snapshot das condições comerciais: nome, preço,
-- desconto... mudanças futuras no Catálogo não podem alterar retroativamente
-- vendas antigas."
--
-- `sales` (0022_sales.sql) já existe e é usada em produção por Tráfego,
-- dashboards (dashboard-tabs-products/sellers), RevenueForecastWidget,
-- SellersRankingWidget, financial-sales-sync — todos leem `product_id`
-- (singular) + `amount_cents` (total). Não alterar essas colunas nem seu
-- significado: `sale_items` é puramente aditivo — quando uma venda tem
-- múltiplos itens, `sales.product_id` fica null (não há "o" produto) e
-- `sales.amount_cents` continua sendo o total, agora composto pela soma dos
-- itens em vez de um valor único digitado.
create table if not exists public.sale_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  sale_id           uuid not null references public.sales(id) on delete cascade,
  -- Referência pro item de catálogo original, só pra rastreabilidade —
  -- nunca lido pra recalcular preço (isso quebraria o snapshot). Pode ficar
  -- null se o produto for excluído do catálogo depois.
  product_id        uuid references public.products(id) on delete set null,
  name              text not null,
  description       text,
  unit_price_cents  integer not null default 0,
  quantity          integer not null default 1 check (quantity > 0),
  discount_cents    integer not null default 0,
  is_recurring      boolean not null default false,
  duration_months   integer,
  created_at        timestamptz not null default now()
);

create index if not exists idx_sale_items_sale on public.sale_items(sale_id);
create index if not exists idx_sale_items_org on public.sale_items(organization_id);

alter table public.sale_items enable row level security;

create policy "org members access sale_items" on public.sale_items
  for all using (organization_id in (select get_user_organizations()));
