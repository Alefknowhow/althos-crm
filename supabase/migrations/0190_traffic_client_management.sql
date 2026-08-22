-- Vertical Agências de Tráfego — correção pós-teste: gestão real de clientes.
-- 1) contatos.traffic_client_profile: perfil estruturado do cliente de tráfego.
-- 2) ad_accounts.contato_id: vincula conta de anúncio a um cliente específico
--    (antes era 1-por-organização, sem separar cliente nenhum).
-- 3) campaign_creatives: aprovação de criativo pelo cliente (upload + status +
--    comentário + link público), sem equivalente genérico no projeto.

ALTER TABLE contatos ADD COLUMN IF NOT EXISTS traffic_client_profile JSONB;

ALTER TABLE ad_accounts ADD COLUMN IF NOT EXISTS contato_id UUID REFERENCES contatos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ad_accounts_contato ON ad_accounts (organization_id, contato_id);

CREATE TABLE IF NOT EXISTS campaign_creatives (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contato_id      UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    storage_key     TEXT NOT NULL,
    media_type      TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'pdf')),
    title           TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'reprovado')),
    client_comment  TEXT,
    public_token    TEXT UNIQUE,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_creatives_org ON campaign_creatives (organization_id);
CREATE INDEX IF NOT EXISTS idx_campaign_creatives_contato ON campaign_creatives (contato_id);
CREATE INDEX IF NOT EXISTS idx_campaign_creatives_status ON campaign_creatives (organization_id, status);

ALTER TABLE campaign_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campaign creatives access" ON campaign_creatives
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Campaign creatives super admin" ON campaign_creatives
  FOR ALL USING ((SELECT is_super_admin()));

CREATE OR REPLACE FUNCTION set_traffic_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campaign_creatives_updated_at
  BEFORE UPDATE ON campaign_creatives
  FOR EACH ROW EXECUTE FUNCTION set_traffic_updated_at();

-- Leitura pública do criativo por token (mesmo padrão de get_public_quotation).
CREATE OR REPLACE FUNCTION public.get_public_creative(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.campaign_creatives%rowtype;
  org jsonb;
  asset_url text;
BEGIN
  SELECT * INTO c FROM public.campaign_creatives WHERE public_token = p_token LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'name', coalesce(s.legal_name, o.name),
    'logo_url', coalesce(s.brand_logo_url, o.logo_url)
  ) INTO org
  FROM public.organizations o
  LEFT JOIN public.org_settings s ON s.org_id = o.id
  WHERE o.id = c.organization_id;

  RETURN jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'description', c.description,
    'media_type', c.media_type,
    'storage_key', c.storage_key,
    'status', c.status,
    'client_comment', c.client_comment,
    'org', org
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_creative(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_creative(text) TO anon, authenticated;

-- Escrita pública restrita: só altera status/comentário do registro do token,
-- nunca outro campo, nunca outro registro.
CREATE OR REPLACE FUNCTION public.update_public_creative_status(p_token text, p_status text, p_comment text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('aprovado', 'reprovado') THEN
    RETURN false;
  END IF;

  UPDATE public.campaign_creatives
  SET status = p_status, client_comment = p_comment
  WHERE public_token = p_token;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.update_public_creative_status(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_public_creative_status(text, text, text) TO anon, authenticated;

COMMENT ON COLUMN contatos.traffic_client_profile IS
  'Vertical Agências de Tráfego — perfil estruturado do cliente (nicho, objetivo, orçamento, público-alvo, regras). Mesmo padrão de contatos.property_preferences.';
COMMENT ON COLUMN ad_accounts.contato_id IS
  'Vertical Agências de Tráfego — vincula a conta de anúncio a um cliente específico. Nullable pra não quebrar contas sem cliente (ex.: conta da própria agência).';
COMMENT ON TABLE campaign_creatives IS
  'Vertical Agências de Tráfego — criativos enviados pra aprovação do cliente, via link público (public_token).';
