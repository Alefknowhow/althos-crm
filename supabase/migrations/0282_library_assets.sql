-- Biblioteca de Tráfego (issue #23) — materiais brutos e criativos
-- produzidos, com versionamento (nova versão não apaga a anterior),
-- comentários em thread e aprovação/reprovação pelo cliente.
--
-- Tabela nova, separada de `campaign_creatives` (migration 0190):
-- campaign_creatives continua servindo o fluxo simples já em produção
-- (1 criativo por campanha, aprovação única, sem versionamento) — não é
-- migrado nem tocado aqui. Esta tabela cobre o escopo mais amplo da #23.
--
-- Upload novo usa StorageService/R2 (storage_object_id -> storage_objects),
-- ao contrário de campaign_creatives que ainda usa o bucket legado
-- `form-assets` do Supabase Storage direto.

create table public.library_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contato_id uuid not null references contatos(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  kind text not null check (kind in ('bruto', 'produzido')),
  -- root_asset_id aponta pra v1 da cadeia (nela mesma) — permite agrupar
  -- todas as versões de um asset com uma única query por root_asset_id.
  root_asset_id uuid references library_assets(id) on delete cascade,
  parent_asset_id uuid references library_assets(id) on delete set null,
  version integer not null default 1,
  storage_object_id uuid not null references storage_objects(id) on delete restrict,
  title text not null,
  description text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'alteracao_solicitada')),
  public_token text unique,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index library_assets_org_idx on public.library_assets(organization_id);
create index library_assets_contato_idx on public.library_assets(contato_id, organization_id);
create index library_assets_root_idx on public.library_assets(root_asset_id);
create unique index library_assets_public_token_idx on public.library_assets(public_token) where public_token is not null;

alter table public.library_assets enable row level security;

create policy "Library assets access" on public.library_assets
  for all using (organization_id in (select get_user_organizations()));

create policy "Library assets super admin" on public.library_assets
  for all using ((select is_super_admin()));

create table public.library_asset_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  asset_id uuid not null references library_assets(id) on delete cascade,
  author_type text not null check (author_type in ('team', 'client')),
  author_name text,
  user_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index library_asset_comments_asset_idx on public.library_asset_comments(asset_id, created_at);

alter table public.library_asset_comments enable row level security;

create policy "Library asset comments access" on public.library_asset_comments
  for all using (organization_id in (select get_user_organizations()));

create policy "Library asset comments super admin" on public.library_asset_comments
  for all using ((select is_super_admin()));

-- Leitura pública (aprovação sem login) — mesmo espírito de
-- get_public_creative (0190), mas retorna também o locator do storage
-- object (provider/bucket/key) pra a aplicação assinar a URL de leitura
-- via StorageService no server (o segredo de assinatura nunca sai daqui).
create or replace function public.get_public_library_asset(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset record;
  v_comments jsonb;
begin
  select a.id, a.title, a.description, a.kind, a.status, a.version, a.created_at,
         o.storage_provider, o.bucket, o.storage_key, o.mime_type, o.filename
  into v_asset
  from library_assets a
  join storage_objects o on o.id = a.storage_object_id
  where a.public_token = p_token;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'authorType', c.author_type, 'authorName', c.author_name,
    'body', c.body, 'createdAt', c.created_at
  ) order by c.created_at asc), '[]'::jsonb)
  into v_comments
  from library_asset_comments c
  where c.asset_id = v_asset.id;

  return jsonb_build_object(
    'id', v_asset.id, 'title', v_asset.title, 'description', v_asset.description,
    'kind', v_asset.kind, 'status', v_asset.status, 'version', v_asset.version,
    'createdAt', v_asset.created_at,
    'storageProvider', v_asset.storage_provider, 'bucket', v_asset.bucket,
    'storageKey', v_asset.storage_key, 'mimeType', v_asset.mime_type, 'filename', v_asset.filename,
    'comments', v_comments
  );
end;
$$;

-- Escrita pública restrita: só troca status (aprovado|alteracao_solicitada)
-- e opcionalmente adiciona um comentário do cliente na linha do token —
-- nunca permite alterar outra coisa (mesmo padrão de segurança de
-- update_public_creative_status, 0190).
create or replace function public.update_public_library_asset_status(p_token text, p_status text, p_comment text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset_id uuid;
  v_org_id uuid;
begin
  if p_status not in ('aprovado', 'alteracao_solicitada') then
    return false;
  end if;

  select id, organization_id into v_asset_id, v_org_id
  from library_assets
  where public_token = p_token;

  if not found then
    return false;
  end if;

  update library_assets set status = p_status where id = v_asset_id;

  if p_comment is not null and length(trim(p_comment)) > 0 then
    insert into library_asset_comments (organization_id, asset_id, author_type, author_name, body)
    values (v_org_id, v_asset_id, 'client', null, trim(p_comment));
  end if;

  return true;
end;
$$;

grant execute on function public.get_public_library_asset(text) to anon, authenticated;
grant execute on function public.update_public_library_asset_status(text, text, text) to anon, authenticated;
