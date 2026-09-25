-- Biblioteca de Tráfego — guarda a dimensão original do material (largura/
-- altura em px) pra exibir sem esticar/cortar (aspect-ratio real), com
-- tamanho máximo padrão só de moldura, não de conteúdo. Detectado no
-- browser antes do upload (vídeo/imagem); quando não é possível detectar,
-- a UI pergunta o enquadramento (retrato/paisagem/quadrado) e grava uma
-- proporção aproximada equivalente.

alter table public.library_assets add column width integer;
alter table public.library_assets add column height integer;

-- Expõe width/height também na leitura pública (aprovação sem login).
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
         a.width, a.height,
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
    'width', v_asset.width, 'height', v_asset.height,
    'storageProvider', v_asset.storage_provider, 'bucket', v_asset.bucket,
    'storageKey', v_asset.storage_key, 'mimeType', v_asset.mime_type, 'filename', v_asset.filename,
    'comments', v_comments
  );
end;
$$;
