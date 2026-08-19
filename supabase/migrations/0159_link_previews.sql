-- Cache global de metadados Open Graph (título/descrição/imagem) pra
-- pré-visualização de links em mensagens (WhatsApp) — clicável + card com
-- prévia, igual o WhatsApp de verdade faz. Não é dado de tenant: o
-- conteúdo vem do site de destino, público por natureza — então sem
-- organization_id/RLS por org, só exige usuário autenticado pra ler.
-- Escrita só pelo admin client (fetchLinkPreview, server-only).
CREATE TABLE IF NOT EXISTS public.link_previews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url           TEXT NOT NULL UNIQUE,
  title         TEXT,
  description   TEXT,
  site_name     TEXT,
  image_url     TEXT,
  image_mime    TEXT,
  fetch_failed  BOOLEAN NOT NULL DEFAULT false,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.link_previews IS
  'Cache global de metadados Open Graph pra pré-visualização de links em mensagens. Sem organization_id/RLS por org — conteúdo público do site de destino, não dado de tenant.';

ALTER TABLE public.link_previews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "link_previews_read_authenticated" ON public.link_previews
  FOR SELECT USING (auth.uid() IS NOT NULL);
