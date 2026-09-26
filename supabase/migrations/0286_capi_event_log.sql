-- Log de envios do Meta CAPI (issue #27/#61, passo 2.3) — observabilidade
-- pra saúde do tracking (Portal e painel interno), não afeta o envio em si.
create table if not exists capi_event_log (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    pipeline_id uuid references pipelines(id) on delete set null,
    contato_id uuid references contatos(id) on delete set null,
    event_name text not null,
    event_id text,
    status text not null check (status in ('sent', 'failed')),
    http_status int,
    error text,
    source text not null check (source in ('form', 'pipeline', 'qualification', 'portal_conversion')),
    created_at timestamptz not null default now()
);

create index if not exists idx_capi_event_log_org_created on capi_event_log (organization_id, created_at desc);
create index if not exists idx_capi_event_log_contato on capi_event_log (contato_id) where contato_id is not null;

alter table capi_event_log enable row level security;

create policy "capi_event_log_org_isolation" on capi_event_log
    for all
    using (organization_id in (select get_user_organizations()))
    with check (organization_id in (select get_user_organizations()));
