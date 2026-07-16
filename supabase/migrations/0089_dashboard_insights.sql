-- ══════════════════════════════════════════════════════════════════════════
-- Insights automáticos da Inicial: detecções por regra/threshold (sem IA,
-- sem gastar crédito), pré-computadas por um job Inngest e só lidas no
-- render — a faixa de chips no topo da Inicial.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.dashboard_insights (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  kind             text not null check (kind in ('opportunity', 'risk', 'info')),
  icon             text,
  text             text not null,
  deep_link        text,
  score            numeric not null default 0,
  created_at       timestamptz not null default now(),
  dismissed_at     timestamptz
);

create index if not exists idx_dashboard_insights_org
  on public.dashboard_insights(organization_id, dismissed_at, score desc);

alter table public.dashboard_insights enable row level security;

drop policy if exists "org members view dashboard_insights" on public.dashboard_insights;
create policy "org members view dashboard_insights" on public.dashboard_insights for select
  using (organization_id in (select organization_id from public.memberships where user_id = auth.uid()));

drop policy if exists "org members dismiss dashboard_insights" on public.dashboard_insights;
create policy "org members dismiss dashboard_insights" on public.dashboard_insights for update
  using (organization_id in (select organization_id from public.memberships where user_id = auth.uid()));
