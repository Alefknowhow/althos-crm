CREATE TABLE IF NOT EXISTS insurance_claims (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    policy_id             UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    contato_id            UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    claim_type            TEXT,
    occurred_at           DATE,
    protocol_number       TEXT,
    description           TEXT,
    responsavel_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status                TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN (
        'aberto', 'em_analise', 'aguardando_documentos', 'em_regulacao',
        'aprovado', 'negado', 'concluido'
    )),
    notes                 TEXT,
    created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_org ON insurance_claims (organization_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy ON insurance_claims (policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_contato ON insurance_claims (contato_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims (organization_id, status);

ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insurance claims access" ON insurance_claims
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Insurance claims super admin" ON insurance_claims
  FOR ALL USING ((SELECT is_super_admin()));

CREATE TRIGGER trg_insurance_claims_updated_at
  BEFORE UPDATE ON insurance_claims
  FOR EACH ROW EXECUTE FUNCTION set_insurance_updated_at();

CREATE TABLE IF NOT EXISTS insurance_claim_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    claim_id        UUID NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
    storage_key     TEXT NOT NULL,
    label           TEXT,
    kind            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claim_documents_claim ON insurance_claim_documents (claim_id);

ALTER TABLE insurance_claim_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insurance claim documents access" ON insurance_claim_documents
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Insurance claim documents super admin" ON insurance_claim_documents
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE insurance_claims IS
  'Vertical Seguros (Fase 5) — sinistros vinculados a uma apólice. Seguradora vem via join com insurance_policies (não desnormalizada — seguradora de uma apólice não muda).';
