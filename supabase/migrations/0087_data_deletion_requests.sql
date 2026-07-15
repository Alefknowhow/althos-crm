-- ══════════════════════════════════════════════════════════════════════════
-- Solicitações de exclusão de dados (exigência da Meta para apps que usam
-- Login do Instagram/Facebook — "Data Deletion Instructions URL").
--
-- Página pública (app/exclusao-de-dados) recebe o pedido de quem interagiu
-- com o Instagram de alguma agência; tentamos casar automaticamente com a
-- organização pelo @ do Instagram informado (social_connections.username),
-- mas o pedido fica registrado mesmo sem match (organization_id null) para
-- triagem manual. A agência resolve manualmente (exclui o lead/conversa nas
-- telas normais do CRM) e só marca o pedido como concluído aqui.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.data_deletion_requests (
  id                  uuid primary key default gen_random_uuid(),
  -- null até conseguirmos casar com uma organização (ou se não conseguirmos).
  organization_id     uuid references public.organizations(id) on delete cascade,
  platform            text not null default 'instagram' check (platform in ('instagram', 'whatsapp', 'other')),
  -- @ do Instagram da EMPRESA que a pessoa contatou (usado para o match).
  business_username   text not null,
  requester_name      text,
  -- e-mail, telefone ou @ do Instagram da própria pessoa, para retorno.
  requester_contact   text,
  message             text,
  status              text not null default 'pending' check (status in ('pending', 'resolved')),
  resolved_at         timestamptz,
  resolved_by         uuid,
  created_at          timestamptz not null default now()
);

create index if not exists idx_data_deletion_requests_org
  on public.data_deletion_requests(organization_id, status);

alter table public.data_deletion_requests enable row level security;

-- Membros da org só veem os pedidos já casados com a própria organização.
-- INSERT vem sempre do admin client (rota pública, sem sessão) — sem policy
-- de insert para usuários comuns.
drop policy if exists "org members view data_deletion_requests" on public.data_deletion_requests;
create policy "org members view data_deletion_requests" on public.data_deletion_requests for select
  using (organization_id in (select organization_id from public.memberships where user_id = auth.uid()));

drop policy if exists "org members resolve data_deletion_requests" on public.data_deletion_requests;
create policy "org members resolve data_deletion_requests" on public.data_deletion_requests for update
  using (organization_id in (select organization_id from public.memberships where user_id = auth.uid()));
