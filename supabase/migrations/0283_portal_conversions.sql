-- Portal do Cliente — Conversões manuais (issue #27 §5 / follow-up #61).
-- Permite o cliente registrar/confirmar um resultado real (lead,
-- qualificação, agendamento, venda, perdido) quando não é capturado
-- automaticamente pelo funil de tracking_links já existente. Complemento,
-- não substitui: o funil automático (tracking_clicks/sales) continua
-- sendo a fonte primária quando disponível.

create table public.portal_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contato_id uuid not null references contatos(id) on delete cascade,
  type text not null check (type in ('lead', 'qualificado', 'agendamento', 'venda', 'perdido')),
  value_cents integer,
  occurred_at date not null default current_date,
  note text,
  submitted_by uuid, -- user_id do portal (client_portal_memberships), sem FK pra auth.users
  created_at timestamptz not null default now()
);

create index portal_conversions_org_idx on public.portal_conversions(organization_id);
create index portal_conversions_contato_idx on public.portal_conversions(contato_id, organization_id);

alter table public.portal_conversions enable row level security;

-- Mesma política de member interno (get_user_organizations()) — o usuário
-- do portal nunca tem membership, então escreve/lê sempre via admin
-- client nas actions (requirePortalAccess valida o vínculo antes), igual
-- ao padrão já documentado em actions/client-portal.ts.
create policy "Portal conversions access" on public.portal_conversions
  for all using (organization_id in (select get_user_organizations()));

create policy "Portal conversions super admin" on public.portal_conversions
  for all using ((select is_super_admin()));
