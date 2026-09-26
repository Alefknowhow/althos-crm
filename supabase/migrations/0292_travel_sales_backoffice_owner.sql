-- Issue #15 — responsável operacional (backoffice) da Reserva, separado do
-- vendedor. `operator` já existe em travel_sales mas é a OPERADORA DE
-- TURISMO (texto), não pessoa — por isso os nomes novos evitam "operator*".
alter table travel_sales
    add column if not exists seller_id uuid references profiles(id) on delete set null,
    add column if not exists backoffice_owner_id uuid references profiles(id) on delete set null;

comment on column travel_sales.seller_id is 'Vendedor responsável pela reserva (pessoa) — não confundir com operator (operadora de turismo, texto livre).';
comment on column travel_sales.backoffice_owner_id is 'Responsável operacional/backoffice da reserva (issue #15) — opcional, sem relação com o vendedor.';

-- Backfill: preserva o comportamento atual em que o criador é o vendedor.
update travel_sales set seller_id = created_by where seller_id is null;

create index if not exists idx_travel_sales_seller on travel_sales (organization_id, seller_id);
create index if not exists idx_travel_sales_backoffice_owner on travel_sales (organization_id, backoffice_owner_id);
