-- ══════════════════════════════════════════════════════════════════════════
-- Social Automations: Instagram DMs + comment auto-replies
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Social connections (Instagram / Facebook pages linked) ────────────────

create table if not exists social_connections (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  platform         text not null check (platform in ('instagram', 'facebook')),
  page_id          text not null,
  page_name        text,
  username         text,
  -- encrypted token stored here; in production use Vault or a secrets store
  access_token     text not null,
  token_expires_at timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, platform, page_id)
);

alter table social_connections enable row level security;

drop policy if exists "org members can manage their social connections" on social_connections;
create policy "org members can manage their social connections"
  on social_connections for all
  using (
    organization_id in (
      select organization_id from memberships
      where user_id = auth.uid()
    )
  );

-- ── 2. Social automation rules ───────────────────────────────────────────────

create table if not exists social_automations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  trigger_type     text not null check (trigger_type in ('dm', 'comment', 'dm_and_comment')),
  -- optional keyword filter; null = respond to ALL messages
  trigger_keywords text[],
  response_type    text not null default 'ai' check (response_type in ('ai', 'fixed')),
  -- for response_type = 'fixed'
  fixed_response   text,
  -- for response_type = 'ai': extra context/instructions for the AI
  ai_instructions  text,
  -- when true, a lead is created/matched automatically for each interaction
  create_lead      boolean not null default true,
  -- comment-specific: send a DM after replying publicly
  send_dm_after_comment boolean not null default false,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table social_automations enable row level security;

drop policy if exists "org members can manage their social automations" on social_automations;
create policy "org members can manage their social automations"
  on social_automations for all
  using (
    organization_id in (
      select organization_id from memberships
      where user_id = auth.uid()
    )
  );

-- ── 3. Social interactions log ───────────────────────────────────────────────

create table if not exists social_interactions (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id) on delete cascade,
  social_connection_id uuid references social_connections(id) on delete set null,
  social_automation_id uuid references social_automations(id) on delete set null,
  lead_id              uuid references leads(id) on delete set null,
  platform             text not null,
  interaction_type     text not null check (interaction_type in ('dm', 'comment')),
  -- sender info
  sender_external_id   text not null,   -- Instagram/Facebook user ID
  sender_username      text,
  sender_name          text,
  -- content
  inbound_text         text not null,
  post_id              text,            -- for comments: the post this was on
  -- response
  response_text        text,
  response_type        text check (response_type in ('ai', 'fixed', 'manual', 'skipped')),
  responded_at         timestamptz,
  -- lead creation
  lead_created         boolean not null default false,
  -- raw platform event stored for debugging
  raw_payload          jsonb,
  created_at           timestamptz not null default now()
);

alter table social_interactions enable row level security;

drop policy if exists "org members can view their social interactions" on social_interactions;
create policy "org members can view their social interactions"
  on social_interactions for all
  using (
    organization_id in (
      select organization_id from memberships
      where user_id = auth.uid()
    )
  );

-- ── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists idx_social_interactions_org    on social_interactions (organization_id, created_at desc);
create index if not exists idx_social_interactions_lead   on social_interactions (lead_id);
create index if not exists idx_social_automations_org     on social_automations  (organization_id);
create index if not exists idx_social_connections_org     on social_connections  (organization_id);

-- ── updated_at triggers ──────────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_social_connections_updated_at on social_connections;
create trigger trg_social_connections_updated_at
  before update on social_connections
  for each row execute function update_updated_at();

drop trigger if exists trg_social_automations_updated_at on social_automations;
create trigger trg_social_automations_updated_at
  before update on social_automations
  for each row execute function update_updated_at();
