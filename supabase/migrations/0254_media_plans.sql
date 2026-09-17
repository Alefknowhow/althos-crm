-- Módulo Clientes (Agências de Tráfego) — Fase 2: Estratégia estruturada.
-- Antes, "Estratégia" era só o JSONB solto contatos.traffic_client_profile
-- (metas/público-alvo em texto livre). Isso não permite representar um plano
-- de mídia versionado por plataforma/campanha/conjunto/anúncio, nem serve de
-- base pra publicação futura via API (Meta/Google/etc.) ou pro Marketing
-- Strategist (IA).
--
-- media_plans: o plano de mídia em si (objetivo, período, orçamento total,
-- metas, distribuição de budget por plataforma) — versionado, editável.
-- media_plan_items: a árvore Campanha → Conjunto → Anúncio dentro de um
-- plano, uma linha por nó. Colunas comuns (platform, budget, status,
-- funnel_stage) cobrem o que é cruzável entre plataformas; `config` (jsonb)
-- guarda os campos específicos de cada plataforma/nível — schema livre de
-- propósito (Meta e Google não têm o mesmo shape, não faz sentido forçar
-- colunas rígidas pra ambos agora, conforme a própria especificação pede).
-- Nível "ad" pode referenciar um criativo já existente na biblioteca
-- (campaign_creatives) em vez de duplicar o asset.

CREATE TABLE IF NOT EXISTS media_plans (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contato_id           UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    version              INTEGER NOT NULL DEFAULT 1,
    status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
    objective_primary    TEXT,
    objectives_secondary TEXT[],
    period_start         DATE,
    period_end           DATE,
    budget_total_cents   BIGINT,
    target_leads         INTEGER,
    target_cpl_cents     BIGINT,
    target_cac_cents     BIGINT,
    target_roas          NUMERIC,
    notes                TEXT,
    platform_budgets     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_plans_org ON media_plans (organization_id);
CREATE INDEX IF NOT EXISTS idx_media_plans_contato ON media_plans (organization_id, contato_id);

ALTER TABLE media_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Media plans access" ON media_plans
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Media plans super admin" ON media_plans
  FOR ALL USING ((SELECT is_super_admin()));

CREATE TABLE IF NOT EXISTS media_plan_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    media_plan_id   UUID NOT NULL REFERENCES media_plans(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES media_plan_items(id) ON DELETE CASCADE,
    level           TEXT NOT NULL CHECK (level IN ('campaign', 'adset', 'ad')),
    platform        TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'gpt_ads', 'other')),
    funnel_stage    TEXT CHECK (funnel_stage IN ('topo', 'meio', 'fundo')),
    name            TEXT NOT NULL,
    objective       TEXT,
    status          TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'ready', 'published', 'paused', 'archived')),
    budget_cents    BIGINT,
    budget_type     TEXT CHECK (budget_type IN ('daily', 'lifetime')),
    creative_id     UUID REFERENCES campaign_creatives(id) ON DELETE SET NULL,
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    order_index     INTEGER NOT NULL DEFAULT 0,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_plan_items_org ON media_plan_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_media_plan_items_plan ON media_plan_items (media_plan_id);
CREATE INDEX IF NOT EXISTS idx_media_plan_items_parent ON media_plan_items (parent_id);
CREATE INDEX IF NOT EXISTS idx_media_plan_items_creative ON media_plan_items (creative_id);

ALTER TABLE media_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Media plan items access" ON media_plan_items
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Media plan items super admin" ON media_plan_items
  FOR ALL USING ((SELECT is_super_admin()));

CREATE TRIGGER trg_media_plans_updated_at
  BEFORE UPDATE ON media_plans
  FOR EACH ROW EXECUTE FUNCTION set_traffic_updated_at();

CREATE TRIGGER trg_media_plan_items_updated_at
  BEFORE UPDATE ON media_plan_items
  FOR EACH ROW EXECUTE FUNCTION set_traffic_updated_at();

COMMENT ON TABLE media_plans IS
  'Módulo Clientes (Tráfego) — plano de mídia estruturado e versionado do cliente. Substitui o plano de mídia solto que só existia como texto em contatos.traffic_client_profile.';
COMMENT ON TABLE media_plan_items IS
  'Módulo Clientes (Tráfego) — árvore Campanha→Conjunto→Anúncio de um media_plan. `config` guarda campos específicos de plataforma/nível (schema livre por propósito — Meta e Google não compartilham shape).';
