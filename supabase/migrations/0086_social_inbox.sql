-- ══════════════════════════════════════════════════════════════════════════
-- Inbox manual de DM do Instagram: histórico completo de mensagens (inbound e
-- outbound, sejam elas de automação/funil ou digitadas por um atendente) e o
-- estado de "quem está no controle" da conversa (bot ou humano).
--
-- Réplica direta do par whatsapp_conversations/whatsapp_messages (0001), com
-- sender_external_id (IGSID) no lugar de contact_phone.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Conversa (uma por remetente do Instagram) ──────────────────────────
create table if not exists public.social_conversations (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  social_connection_id    uuid references public.social_connections(id) on delete set null,
  contato_id              uuid references public.contatos(id) on delete set null,
  sender_external_id      text not null,     -- IGSID de quem está conversando
  sender_username         text,
  sender_name             text,
  last_message_at         timestamptz,
  last_message_preview    text,
  last_message_direction  text check (last_message_direction in ('inbound', 'outbound')),
  unread_count            integer not null default 0,
  -- true quando um atendente assumiu a conversa manualmente — o motor de
  -- automação/funil para de responder até isso voltar a false.
  automation_paused       boolean not null default false,
  assigned_to             uuid,
  created_at              timestamptz not null default now(),
  unique (social_connection_id, sender_external_id)
);

-- ── 2. Mensagens (histórico completo, uma linha por mensagem) ─────────────
create table if not exists public.social_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.social_conversations(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  direction        text not null check (direction in ('inbound', 'outbound')),
  message_text     text,
  -- quem gerou a mensagem outbound: automação simples, funil, ou atendente
  -- (mensagens inbound são sempre 'user').
  sent_by          text not null default 'user' check (sent_by in ('user', 'automation', 'funnel', 'agent')),
  meta_message_id  text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_social_conversations_org      on public.social_conversations(organization_id);
create index if not exists idx_social_conversations_lookup   on public.social_conversations(social_connection_id, sender_external_id);
create index if not exists idx_social_conversations_last_msg on public.social_conversations(organization_id, last_message_at desc);
create index if not exists idx_social_messages_conversation  on public.social_messages(conversation_id, created_at);
create index if not exists idx_social_messages_org           on public.social_messages(organization_id);

-- ── RLS: membros da org gerenciam; o motor usa admin client (bypassa RLS) ──
alter table public.social_conversations enable row level security;
alter table public.social_messages enable row level security;

drop policy if exists "org members manage social_conversations" on public.social_conversations;
create policy "org members manage social_conversations" on public.social_conversations for all
  using (organization_id in (select organization_id from public.memberships where user_id = auth.uid()));

drop policy if exists "org members manage social_messages" on public.social_messages;
create policy "org members manage social_messages" on public.social_messages for all
  using (organization_id in (select organization_id from public.memberships where user_id = auth.uid()));
