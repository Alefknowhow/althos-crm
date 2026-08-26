-- Produtos da venda (Reservas) — entidades por tipo (aéreo/hospedagem/transfer/
-- cruzeiro/etc.) em vez dos campos flat únicos que travel_sales tinha
-- (hotel_name/airline/flights[]). Colunas antigas de travel_sales NÃO são
-- removidas nesta migration — ficam como legado de leitura/fallback.

create table if not exists public.sale_products (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id         uuid not null references public.travel_sales(id) on delete cascade,
  kind            text not null check (kind in ('aereo','hospedagem','transfer','passeio','cruzeiro','seguro','ingresso','veiculo','outro')),
  status          text not null default 'pending' check (status in ('confirmed','pending')),
  sort_order      integer not null default 0,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_sale_products_sale on public.sale_products(sale_id, sort_order);
create index if not exists idx_sale_products_org  on public.sale_products(organization_id);

alter table public.sale_products enable row level security;

create policy "Org access sale_products" on public.sale_products for all
  using (organization_id in (select get_user_organizations()))
  with check (organization_id in (select get_user_organizations()));

create policy "Super admin read sale_products" on public.sale_products for select using (is_super_admin());

-- Migra flights[] existentes (aéreo) e hotel_name/hotel_locator (hospedagem)
-- pros novos registros de produto, preservando o dado sem apagar as colunas
-- antigas.
insert into public.sale_products (organization_id, sale_id, kind, status, sort_order, data)
select
  ts.organization_id,
  ts.id,
  'aereo',
  'confirmed',
  row_number() over (partition by ts.id order by ordinality) - 1,
  jsonb_build_object(
    'companhia', f->>'companhia',
    'numero_voo', f->>'numero',
    'data', f->>'data',
    'origem', f->>'origem',
    'destino', f->>'destino',
    'horario', f->>'horario',
    'sentido', f->>'sentido',
    'localizador', ts.air_locator
  )
from public.travel_sales ts
cross join lateral jsonb_array_elements(coalesce(ts.flights, '[]'::jsonb)) with ordinality as t(f, ordinality)
where jsonb_typeof(coalesce(ts.flights, '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(ts.flights, '[]'::jsonb)) > 0;

insert into public.sale_products (organization_id, sale_id, kind, status, sort_order, data)
select
  ts.organization_id,
  ts.id,
  'hospedagem',
  'confirmed',
  0,
  jsonb_build_object(
    'hotel', ts.hotel_name,
    'localizador', ts.hotel_locator,
    'check_in', ts.departure_date,
    'check_out', ts.return_date
  )
from public.travel_sales ts
where ts.hotel_name is not null and ts.hotel_name <> '';

-- Origem da tarefa (produto que a gerou), só para exibição — nullable, sem
-- efeito na lógica de tasks existente.
alter table public.tasks add column if not exists source_product_id uuid references public.sale_products(id) on delete set null;
create index if not exists idx_tasks_source_product on public.tasks(source_product_id);
