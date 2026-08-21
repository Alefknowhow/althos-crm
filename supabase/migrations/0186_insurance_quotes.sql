CREATE TABLE IF NOT EXISTS insurance_quotes (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contato_id            UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    insurance_product_id  UUID NOT NULL REFERENCES insurance_products(id) ON DELETE RESTRICT,
    broker_user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status                TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN (
        'rascunho', 'em_cotacao', 'recebida', 'em_analise', 'apresentada',
        'em_negociacao', 'aprovada', 'recusada', 'expirada', 'cancelada'
    )),
    valid_until           DATE,
    notes                 TEXT,
    created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_quotes_org ON insurance_quotes (organization_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quotes_contato ON insurance_quotes (contato_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quotes_status ON insurance_quotes (organization_id, status);

ALTER TABLE insurance_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insurance quotes access" ON insurance_quotes
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Insurance quotes super admin" ON insurance_quotes
  FOR ALL USING ((SELECT is_super_admin()));

CREATE TRIGGER trg_insurance_quotes_updated_at
  BEFORE UPDATE ON insurance_quotes
  FOR EACH ROW EXECUTE FUNCTION set_insurance_updated_at();

CREATE TABLE IF NOT EXISTS insurance_quote_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    quote_id        UUID NOT NULL REFERENCES insurance_quotes(id) ON DELETE CASCADE,
    insurer_id      UUID NOT NULL REFERENCES insurers(id) ON DELETE RESTRICT,
    premium_cents   BIGINT,
    coverage        TEXT,
    franquia        TEXT,
    conditions      TEXT,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_quote_items_quote ON insurance_quote_items (quote_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_items_insurer ON insurance_quote_items (insurer_id);

ALTER TABLE insurance_quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insurance quote items access" ON insurance_quote_items
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Insurance quote items super admin" ON insurance_quote_items
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE insurance_quotes IS
  'Vertical Seguros (Fase 2) — cotação: cliente + produto + N seguradoras comparadas (insurance_quote_items). Espelha property_proposals/property_proposal_items (Imobiliárias).';
COMMENT ON TABLE insurance_quote_items IS
  'Uma linha por seguradora comparada numa cotação, com prêmio/cobertura/franquia/condições próprios. Delete+reinsert total a cada save (mesmo padrão de property_proposal_items).';
