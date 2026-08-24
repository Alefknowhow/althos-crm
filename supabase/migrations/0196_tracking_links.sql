-- Sistema de tracking próprio (Fase 1) — links de rastreamento gerados pela
-- agência (althoscrm.com.br/r/{code}) que registram o clique ANTES de
-- redirecionar, e correlação por cookie 1st-party pra reconstruir jornada
-- multi-touch até a conversão. Ver plano em
-- C:\Users\aleft\.claude\plans\dazzling-baking-anchor.md.

CREATE TABLE IF NOT EXISTS tracking_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code            TEXT NOT NULL UNIQUE,
    destination_url TEXT NOT NULL,
    campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    contato_id      UUID REFERENCES contatos(id) ON DELETE SET NULL,
    label           TEXT,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clicks_count    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tracking_links_org ON tracking_links (organization_id);
CREATE INDEX IF NOT EXISTS idx_tracking_links_contato ON tracking_links (contato_id);

ALTER TABLE tracking_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tracking links access" ON tracking_links
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Tracking links super admin" ON tracking_links
  FOR ALL USING ((SELECT is_super_admin()));

-- Evento de clique — alto volume, anônimo até a conversão. Sem policy de
-- anon/authenticated: só o admin client (service role) grava, na rota de
-- redirect (mesmo padrão de public_request_log, 0036_anti_spam.sql).
CREATE TABLE IF NOT EXISTS tracking_clicks (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id               UUID NOT NULL REFERENCES tracking_links(id) ON DELETE CASCADE,
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    visitor_id            TEXT NOT NULL,
    ip                    TEXT,
    user_agent            TEXT,
    referrer              TEXT,
    utm_source            TEXT,
    utm_medium            TEXT,
    utm_campaign          TEXT,
    utm_content           TEXT,
    utm_term              TEXT,
    gclid                 TEXT,
    fbclid                TEXT,
    converted_contato_id  UUID REFERENCES contatos(id) ON DELETE SET NULL,
    converted_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_clicks_visitor ON tracking_clicks (visitor_id);
CREATE INDEX IF NOT EXISTS idx_tracking_clicks_link ON tracking_clicks (link_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tracking_clicks_org ON tracking_clicks (organization_id);

ALTER TABLE tracking_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tracking clicks read" ON tracking_clicks
  FOR SELECT USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Tracking clicks super admin" ON tracking_clicks
  FOR ALL USING ((SELECT is_super_admin()));

-- Join rápido pro funil sem precisar de subquery por visitor_id toda vez —
-- mesmo espírito de contatos.meta_resolved_campaign_id (0129).
ALTER TABLE contatos ADD COLUMN IF NOT EXISTS tracking_link_id UUID REFERENCES tracking_links(id) ON DELETE SET NULL;

-- Incremento atômico do contador denormalizado (evita "select then update"
-- na rota de redirect, que precisa responder rápido).
CREATE OR REPLACE FUNCTION increment_tracking_link_clicks(p_link_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE tracking_links SET clicks_count = clicks_count + 1 WHERE id = p_link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION increment_tracking_link_clicks(UUID) FROM public;
