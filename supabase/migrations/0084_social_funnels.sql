-- ══════════════════════════════════════════════════════════════════════════
-- Funis de conversa em DM (Instagram): sequência de 3-4+ passos, cada passo
-- mensagem fixa OU resposta por IA, avançando a cada resposta do usuário
-- (respeita a janela de 24h da Meta — o funil só progride quando a pessoa
-- responde, o que reabre a janela).
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Funil ──────────────────────────────────────────────────────────────
create table if not exists public.social_funnels (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null default 'Novo funil',
  -- gatilho que INICIA o funil (comment/story_reply entram nas fases seguintes)
  trigger_type     text not null default 'dm' check (trigger_type in ('dm', 'comment', 'story_reply')),
  -- palavras-chave que disparam o funil; null/vazio = qualquer primeira DM
  trigger_keywords text[],
  create_lead      boolean not null default true,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── 2. Passos do funil (ordenados) ────────────────────────────────────────
create table if not exists public.social_funnel_steps (
  id              uuid primary key default gen_random_uuid(),
  funnel_id       uuid not null references public.social_funnels(id) on delete cascade,
  sort_order      integer not null default 0,
  step_type       text not null default 'message' check (step_type in ('message', 'ai')),
  message_text    text,          -- para step_type = 'message'
  ai_instructions text,          -- para step_type = 'ai'
  -- true: envia e espera a resposta da pessoa antes do próximo passo
  -- false: envia e já dispara o próximo passo em seguida
  wait_for_reply  boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ── 3. Estado da conversa (máquina de estado por remetente) ───────────────
create table if not exists public.social_conversation_state (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  funnel_id            uuid not null references public.social_funnels(id) on delete cascade,
  social_connection_id uuid references public.social_connections(id) on delete set null,
  sender_external_id   text not null,     -- IGSID de quem está no funil
  current_step         integer not null default 0,
  status               text not null default 'active' check (status in ('active', 'done')),
  last_advanced_at     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (funnel_id, sender_external_id)
);

create index if not exists idx_social_funnels_org       on public.social_funnels(organization_id);
create index if not exists idx_social_funnel_steps      on public.social_funnel_steps(funnel_id, sort_order);
create index if not exists idx_social_conv_state_lookup on public.social_conversation_state(social_connection_id, sender_external_id, status);

-- ── RLS: membros da org gerenciam; o motor usa admin client (bypassa RLS) ──
alter table public.social_funnels enable row level security;
alter table public.social_funnel_steps enable row level security;
alter table public.social_conversation_state enable row level security;

drop policy if exists "org members manage social_funnels" on public.social_funnels;
create policy "org members manage social_funnels" on public.social_funnels for all
  using (organization_id in (select organization_id from public.memberships where user_id = auth.uid()));

drop policy if exists "org members manage social_funnel_steps" on public.social_funnel_steps;
create policy "org members manage social_funnel_steps" on public.social_funnel_steps for all
  using (funnel_id in (
    select id from public.social_funnels
    where organization_id in (select organization_id from public.memberships where user_id = auth.uid())
  ));

drop policy if exists "org members view social_conversation_state" on public.social_conversation_state;
create policy "org members view social_conversation_state" on public.social_conversation_state for all
  using (organization_id in (select organization_id from public.memberships where user_id = auth.uid()));

-- ── updated_at triggers (reusa a função criada em 0049) ───────────────────
drop trigger if exists trg_social_funnels_updated_at on public.social_funnels;
create trigger trg_social_funnels_updated_at
  before update on public.social_funnels
  for each row execute function update_updated_at();

drop trigger if exists trg_social_conv_state_updated_at on public.social_conversation_state;
create trigger trg_social_conv_state_updated_at
  before update on public.social_conversation_state
  for each row execute function update_updated_at();
