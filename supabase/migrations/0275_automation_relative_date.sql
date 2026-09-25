-- Issue #18 (fatia 1/N): infraestrutura genérica de "trigger de data relativa"
-- pras automações — "N dias/semanas/meses antes|depois|no momento de um campo
-- de data de uma entidade suportada" (embarque, vencimento de tarefa,
-- aniversário do cliente), em vez de crons fixos por vertical hardcoded.
--
-- O trigger_type novo (`date.relative`) não precisa de coluna/enum aqui —
-- segue o mesmo padrão do resto do módulo (trigger_type é texto livre,
-- validado na aplicação via lib/automations/trigger-meta.ts).
--
-- Esta tabela existe só pra IDEMPOTÊNCIA: o cron que varre as entidades roda
-- de hora em hora (pra respeitar o horário configurado pelo usuário), então
-- precisa de uma trava por (automação, registro, dia) pra nunca disparar o
-- mesmo evento duas vezes mesmo com replay/retry do Inngest.
create table if not exists public.automation_date_fires (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  automation_id   uuid not null references public.automations(id) on delete cascade,
  entity_id       uuid not null,
  fire_date       date not null,
  created_at      timestamptz not null default now(),
  unique (automation_id, entity_id, fire_date)
);

create index if not exists idx_automation_date_fires_automation on public.automation_date_fires(automation_id);
create index if not exists idx_automation_date_fires_org on public.automation_date_fires(organization_id);

alter table public.automation_date_fires enable row level security;

-- Mesma policy usada em `automations`/`automation_runs` (0023_automations_repair.sql).
create policy "org members access automation_date_fires" on public.automation_date_fires
  for all using (organization_id in (select get_user_organizations()));
