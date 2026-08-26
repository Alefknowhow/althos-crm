-- Documentos (Viagens) — módulo simplificado: upload de PDF pronto com um
-- rótulo, listado e aberto/impresso direto, sem tela de edição. Distinto de
-- document_templates (editor de modelo HTML com {{campos}}, usado por
-- Tráfego pros contratos de plano) — este é só arquivo + rótulo.
create table if not exists public.org_documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label           text not null,
  file_path       text not null,
  file_name       text not null,
  file_size_bytes integer,
  mime_type       text,
  uploaded_by     uuid,
  created_at      timestamptz not null default now()
);

create index if not exists idx_org_documents_org on public.org_documents(organization_id, created_at desc);

alter table public.org_documents enable row level security;

create policy "Org documents access" on public.org_documents for all
  using (organization_id in (select get_user_organizations()))
  with check (organization_id in (select get_user_organizations()));

-- Bucket privado — path layout `{org_id}/{timestamp}-{slug}.{ext}`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-documents', 'org-documents', false, 15 * 1024 * 1024, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Org documents read own org" on storage.objects for select
using (
  bucket_id = 'org-documents'
  and (storage.foldername(name))[1]::uuid in (select get_user_organizations())
);

create policy "Org documents write own org" on storage.objects for insert
with check (
  bucket_id = 'org-documents'
  and (storage.foldername(name))[1]::uuid in (select get_user_organizations())
);

create policy "Org documents delete own org" on storage.objects for delete
using (
  bucket_id = 'org-documents'
  and (storage.foldername(name))[1]::uuid in (select get_user_organizations())
);
