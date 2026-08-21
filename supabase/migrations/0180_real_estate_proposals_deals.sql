-- Vertical Imobiliárias — Fase 3: propostas + negociação (venda/locação).
--
-- Espelha o formato já validado por Viagens (travel_proposals → travel_sales)
-- em escala menor: sem localizadores/vouchers/split retida-repasse (não
-- existe operadora em imóveis). financial_entries ganha uma FK dedicada
-- (property_deal_id), mesmo padrão que venda_id já usa pra travel_sales —
-- não uma relação polimórfica nova.

CREATE TABLE IF NOT EXISTS property_proposals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    contato_id          UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    broker_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    operation_type      TEXT NOT NULL DEFAULT 'venda' CHECK (operation_type IN ('venda', 'locacao')),
    offered_price_cents BIGINT,
    conditions          TEXT,
    valid_until         DATE,
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'won', 'lost', 'expired')),
    notes               TEXT,
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_proposals_org ON property_proposals (organization_id);
CREATE INDEX IF NOT EXISTS idx_property_proposals_property ON property_proposals (property_id);
CREATE INDEX IF NOT EXISTS idx_property_proposals_contato ON property_proposals (contato_id);
CREATE INDEX IF NOT EXISTS idx_property_proposals_status ON property_proposals (organization_id, status);

ALTER TABLE property_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property proposals access" ON property_proposals;
CREATE POLICY "Property proposals access" ON property_proposals
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Property proposals super admin" ON property_proposals;
CREATE POLICY "Property proposals super admin" ON property_proposals
  FOR ALL USING ((SELECT is_super_admin()));

CREATE OR REPLACE FUNCTION set_property_proposal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_proposal_updated_at ON property_proposals;
CREATE TRIGGER trg_property_proposal_updated_at
  BEFORE UPDATE ON property_proposals
  FOR EACH ROW EXECUTE FUNCTION set_property_proposal_updated_at();

COMMENT ON TABLE property_proposals IS
  'Proposta formal (imóvel + lead + valor + condições) — status no mesmo vocabulário de travel_proposals.status (draft/sent/viewed/won/lost/expired).';

-- ── Negociação fechada (venda ou locação) ──
CREATE TABLE IF NOT EXISTS property_deals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    proposal_id         UUID REFERENCES property_proposals(id) ON DELETE SET NULL,
    contato_id          UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    owner_contato_id    UUID REFERENCES contatos(id) ON DELETE SET NULL,
    broker_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deal_type           TEXT NOT NULL DEFAULT 'venda' CHECK (deal_type IN ('venda', 'locacao')),
    final_price_cents   BIGINT NOT NULL,
    commission_cents    BIGINT,
    monthly_rent_cents  BIGINT,
    lease_start_date    DATE,
    lease_end_date      DATE,
    status              TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'cancelado')),
    closed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes               TEXT,
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_deals_org ON property_deals (organization_id);
CREATE INDEX IF NOT EXISTS idx_property_deals_property ON property_deals (property_id);
CREATE INDEX IF NOT EXISTS idx_property_deals_contato ON property_deals (contato_id);
CREATE INDEX IF NOT EXISTS idx_property_deals_proposal ON property_deals (proposal_id);

ALTER TABLE property_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property deals access" ON property_deals;
CREATE POLICY "Property deals access" ON property_deals
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Property deals super admin" ON property_deals;
CREATE POLICY "Property deals super admin" ON property_deals
  FOR ALL USING ((SELECT is_super_admin()));

CREATE OR REPLACE FUNCTION set_property_deal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_deal_updated_at ON property_deals;
CREATE TRIGGER trg_property_deal_updated_at
  BEFORE UPDATE ON property_deals
  FOR EACH ROW EXECUTE FUNCTION set_property_deal_updated_at();

COMMENT ON TABLE property_deals IS
  'Negócio fechado (venda ou locação) — status binário como travel_sales.status (aberto/cancelado), sem checklist de etapas. commission_cents sincroniza com financial_entries via property_deal_id.';

-- ── Financeiro: FK dedicada, mesmo padrão de financial_entries.venda_id ──
ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS property_deal_id UUID REFERENCES property_deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_entries_property_deal ON financial_entries (property_deal_id);
