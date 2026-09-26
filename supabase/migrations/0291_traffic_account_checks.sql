-- "Analisar contas" — operação diária (#22, passo 3.6). Snapshot do health
-- check de cada cliente com conta ativa, pra histórico e pra tela "Contas
-- que exigem atenção". Sem IA aqui (custo/créditos) — só a regra
-- determinística já usada no painel (computeClientAlerts/computeClientHealthStatus).
create table if not exists traffic_account_checks (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    contato_id uuid not null references contatos(id) on delete cascade,
    check_date date not null default current_date,
    health text not null check (health in ('saudavel', 'atencao', 'critico', 'sem_dados')),
    alerts jsonb not null default '[]',
    created_at timestamptz not null default now(),
    unique (organization_id, contato_id, check_date)
);

create index if not exists idx_traffic_account_checks_org_date on traffic_account_checks (organization_id, check_date desc);

alter table traffic_account_checks enable row level security;
create policy "traffic_account_checks_org_isolation" on traffic_account_checks
    for all using (organization_id in (select get_user_organizations()));
create policy "traffic_account_checks_super_admin" on traffic_account_checks
    for all using ((select is_super_admin()));
