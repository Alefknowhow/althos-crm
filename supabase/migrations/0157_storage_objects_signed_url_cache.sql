-- Cache da signed URL de leitura, direto na própria linha do objeto —
-- evita reassinar (e principalmente perder o cache HTTP do navegador
-- por causa da URL mudar) a cada visualização. Só guarda a URL (texto)
-- e a validade; o arquivo em si nunca passa por aqui, então isso não
-- tem nenhum efeito no ganho de egress da migração pro R2 (a resposta
-- HTTP com os bytes do arquivo sempre vai direto navegador↔R2).
--
-- TTL padrão de 48h é aplicado em código (lib/storage/index.ts), não
-- aqui — esta migration só cria onde guardar o resultado.
alter table public.storage_objects
  add column if not exists cached_signed_url text;

alter table public.storage_objects
  add column if not exists cached_signed_url_expires_at timestamptz;
