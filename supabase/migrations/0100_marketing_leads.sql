-- Leads capturados no site institucional (fora do CRM multi-tenant) — hoje só
-- o formulário "Fale com vendas" do plano Business ("Sob consulta"), que antes
-- só abria um mailto:. Sem organization_id: é um lead da Althos, não de um
-- cliente Althos.
create table if not exists marketing_leads (
  id           uuid primary key default gen_random_uuid(),
  source       text not null default 'business_plan', -- ex.: 'business_plan'
  name         text not null,
  email        text not null,
  phone        text,
  company      text,
  message      text,
  created_at   timestamptz not null default now()
);

alter table marketing_leads enable row level security;

-- Sem sessão de usuário (formulário público, pré-signup) — só o service role
-- (admin client, usado pela server action) grava/lê. Nenhuma policy pra
-- anon/authenticated: RLS fecha tudo por padrão.
