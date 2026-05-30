-- ══════════════════════════════════════════════════════════════════════════
-- WhatsApp HSM Template Library
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists whatsapp_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,

  -- Meta-side identity
  name             text not null,          -- exact Meta name, e.g. boas_vindas_v1
  display_name     text not null,          -- friendly label for the UI

  -- Template metadata
  category         text not null default 'UTILITY'
                   check (category in ('UTILITY','MARKETING','AUTHENTICATION')),
  language         text not null default 'pt_BR',

  -- Header (optional)
  header_type      text not null default 'none'
                   check (header_type in ('none','text','image','video','document')),
  header_text      text,           -- when header_type = 'text'
  header_media_url text,           -- public URL when header_type = image/video/document

  -- Body (required)
  body_text        text not null,  -- e.g. "Olá, {{1}}! Seu pedido {{2}} foi confirmado."
  -- Friendly labels for each {{n}} variable, index-aligned
  variable_names   text[],         -- e.g. ['nome', 'número do pedido']

  -- Footer (optional)
  footer_text      text,

  -- Local status tracking (NOT managed by Meta — just for reference)
  status           text not null default 'local'
                   check (status in ('local','pending','approved','rejected')),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (organization_id, name)
);

alter table whatsapp_templates enable row level security;

drop policy if exists "org members manage whatsapp_templates" on whatsapp_templates;
create policy "org members manage whatsapp_templates"
  on whatsapp_templates for all
  using (
    organization_id in (
      select organization_id from memberships
      where user_id = auth.uid()
    )
  );

create index if not exists idx_whatsapp_templates_org on whatsapp_templates (organization_id);

drop trigger if exists trg_whatsapp_templates_updated_at on whatsapp_templates;
create trigger trg_whatsapp_templates_updated_at
  before update on whatsapp_templates
  for each row execute function update_updated_at();

-- ── Storage bucket for WhatsApp media (images, documents, videos) ─────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-assets',
  'whatsapp-assets',
  true,
  16 * 1024 * 1024,  -- 16 MB (Meta limit for images)
  array['image/png','image/jpeg','image/jpg','image/webp','application/pdf',
        'video/mp4','video/3gpp']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "WA assets read public"     on storage.objects;
drop policy if exists "WA assets write own org"   on storage.objects;
drop policy if exists "WA assets delete own org"  on storage.objects;

create policy "WA assets read public"
  on storage.objects for select
  using (bucket_id = 'whatsapp-assets');

create policy "WA assets write own org"
  on storage.objects for insert
  with check (
    bucket_id = 'whatsapp-assets'
    and (storage.foldername(name))[1]::uuid in (select get_user_organizations())
  );

create policy "WA assets delete own org"
  on storage.objects for delete
  using (
    bucket_id = 'whatsapp-assets'
    and (storage.foldername(name))[1]::uuid in (select get_user_organizations())
  );
