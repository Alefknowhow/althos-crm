-- ══════════════════════════════════════════════════════════════════════════
-- Layout configurável da Inicial (dashboard): quais widgets aparecem, em que
-- ordem, e os gráficos fixados pelo copiloto. Um registro por (org, usuário)
-- — cada membro personaliza a própria visão sem afetar os demais.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.dashboard_layouts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null,
  widget_keys      text[] not null default '{}',
  pinned_cards     jsonb not null default '[]',
  period_default   text not null default '30d',
  updated_at       timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public.dashboard_layouts enable row level security;

drop policy if exists "users manage own dashboard_layout" on public.dashboard_layouts;
create policy "users manage own dashboard_layout" on public.dashboard_layouts for all
  using (
    user_id = auth.uid()
    and organization_id in (select organization_id from public.memberships where user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and organization_id in (select organization_id from public.memberships where user_id = auth.uid())
  );

drop trigger if exists trg_dashboard_layouts_updated_at on public.dashboard_layouts;
create trigger trg_dashboard_layouts_updated_at
  before update on public.dashboard_layouts
  for each row execute function update_updated_at();
