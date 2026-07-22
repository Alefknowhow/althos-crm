-- Solicitações de add-on (usuários extras, lojas/agências extras, módulos de
-- nicho) feitas dentro do app, em Configurações > Assinatura. Diferente dos
-- créditos de IA (compra avulsa self-service via Asaas), esses três add-ons
-- ajustam o valor recorrente da assinatura — nesta leva o time comercial
-- processa manualmente (recebe a solicitação por e-mail + fila aqui) em vez
-- de recalcular a assinatura Asaas automaticamente.
create table if not exists addon_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  requested_by     uuid references auth.users(id) on delete set null,
  kind             text not null, -- 'extra_users' | 'extra_orgs' | 'niche_module'
  details          jsonb not null default '{}'::jsonb,
  status           text not null default 'pending', -- 'pending' | 'done' | 'rejected'
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create index if not exists addon_requests_org_idx on addon_requests(organization_id);

alter table addon_requests enable row level security;

-- Membros da organização podem ver/criar as próprias solicitações.
create policy addon_requests_select on addon_requests
  for select using (
    organization_id in (
      select organization_id from memberships where user_id = auth.uid()
    )
  );

create policy addon_requests_insert on addon_requests
  for insert with check (
    organization_id in (
      select organization_id from memberships where user_id = auth.uid()
    )
  );
