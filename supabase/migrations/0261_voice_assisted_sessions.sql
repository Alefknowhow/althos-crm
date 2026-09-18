-- Althos Voice — chamada assistida: o vendedor liga (humano) e acompanha um
-- chat lateral com a transcrição do outro lado traduzida em tempo real,
-- gerado pelo serviço realtime (services/sales-coach-realtime, reaproveitado
-- também para este fluxo) via Twilio Media Streams + ElevenLabs Scribe.
-- Só texto (tradução falada nos dois sentidos ficou fora de escopo desta
-- fase, por decisão de produto).

create table if not exists voice_assisted_sessions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  voice_call_id     uuid not null references voice_calls(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  target_language   text not null default 'en',
  status            text not null default 'starting' check (status in ('starting', 'live', 'ended', 'failed')),
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  duration_seconds  integer,
  created_at        timestamptz not null default now()
);

create index if not exists voice_assisted_sessions_org_idx on voice_assisted_sessions(organization_id, created_at desc);
create index if not exists voice_assisted_sessions_call_idx on voice_assisted_sessions(voice_call_id);

alter table voice_assisted_sessions enable row level security;

create policy "voice_assisted_sessions_org_isolation" on voice_assisted_sessions
  for all using (organization_id in (select get_user_organizations()))
  with check (organization_id in (select get_user_organizations()));

create policy "voice_assisted_sessions_super_admin" on voice_assisted_sessions
  for all using (
    exists (select 1 from auth.users u where u.id = auth.uid() and (u.raw_user_meta_data->>'is_super_admin')::boolean is true)
  );

create table if not exists voice_assisted_transcript_segments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  session_id        uuid not null references voice_assisted_sessions(id) on delete cascade,
  speaker           text not null check (speaker in ('supplier', 'agent')),
  original_text     text not null,
  original_language text,
  translated_text   text,
  started_at_ms     integer,
  ended_at_ms       integer,
  created_at        timestamptz not null default now()
);

create index if not exists voice_assisted_segments_session_idx on voice_assisted_transcript_segments(session_id, created_at);

alter table voice_assisted_transcript_segments enable row level security;

create policy "voice_assisted_segments_org_isolation" on voice_assisted_transcript_segments
  for all using (organization_id in (select get_user_organizations()))
  with check (organization_id in (select get_user_organizations()));

create policy "voice_assisted_segments_super_admin" on voice_assisted_transcript_segments
  for all using (
    exists (select 1 from auth.users u where u.id = auth.uid() and (u.raw_user_meta_data->>'is_super_admin')::boolean is true)
  );
