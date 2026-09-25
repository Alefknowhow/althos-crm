-- Issue #18, seção 18 (versionamento): "Automation → versão atual,
-- Automation Version → definição imutável, Automation Run → aponta pra
-- versão executada" — hoje editar uma automação ativa sobrescreve
-- `steps`/`flow` in-place, então um run em andamento pode passar a ler uma
-- definição diferente da que estava rodando quando começou.
--
-- `automation_versions` guarda um snapshot imutável a cada criação/edição da
-- definição (trigger/steps/flow); `automations.current_version_id` aponta
-- pra versão vigente (pra UI mostrar "v3" e comparar histórico);
-- `automation_runs.automation_version_id` fixa QUAL versão aquele run está
-- executando — o motor passa a ler dali quando presente, com fallback pra
-- `automations.steps/flow` ao vivo pra runs antigos (criados antes desta
-- migration, sem versão pinada).
create table if not exists public.automation_versions (
  id               uuid primary key default gen_random_uuid(),
  automation_id    uuid not null references public.automations(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  version_number   integer not null,
  trigger_type     text not null,
  trigger_config   jsonb not null default '{}'::jsonb,
  steps            jsonb not null default '[]'::jsonb,
  flow             jsonb,
  created_at       timestamptz not null default now(),
  unique (automation_id, version_number)
);

create index if not exists idx_automation_versions_automation on public.automation_versions(automation_id);

alter table public.automation_versions enable row level security;
create policy "org members access automation_versions" on public.automation_versions
  for all using (organization_id in (select get_user_organizations()));

alter table public.automations
  add column if not exists current_version_id uuid references public.automation_versions(id) on delete set null;

alter table public.automation_runs
  add column if not exists automation_version_id uuid references public.automation_versions(id) on delete set null;

create index if not exists idx_automation_runs_version on public.automation_runs(automation_version_id);
