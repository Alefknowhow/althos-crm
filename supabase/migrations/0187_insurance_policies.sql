CREATE TABLE IF NOT EXISTS insurance_policies (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    policy_number         TEXT,
    quote_id              UUID REFERENCES insurance_quotes(id) ON DELETE SET NULL,
    contato_id            UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    insurance_product_id  UUID NOT NULL REFERENCES insurance_products(id) ON DELETE RESTRICT,
    insurer_id            UUID NOT NULL REFERENCES insurers(id) ON DELETE RESTRICT,
    broker_user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    premium_cents         BIGINT NOT NULL,
    start_date            DATE,
    end_date              DATE,
    payment_method        TEXT,
    installments_count    INT NOT NULL DEFAULT 1,
    commission_cents      BIGINT,
    status                TEXT NOT NULL DEFAULT 'em_emissao' CHECK (status IN (
        'em_emissao', 'ativa', 'suspensa', 'cancelada', 'expirada'
    )),
    notes                 TEXT,
    created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_insurance_policies_number ON insurance_policies (organization_id, policy_number);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_org ON insurance_policies (organization_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_contato ON insurance_policies (contato_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_status ON insurance_policies (organization_id, status);

ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insurance policies access" ON insurance_policies
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Insurance policies super admin" ON insurance_policies
  FOR ALL USING ((SELECT is_super_admin()));

CREATE TRIGGER trg_insurance_policies_updated_at
  BEFORE UPDATE ON insurance_policies
  FOR EACH ROW EXECUTE FUNCTION set_insurance_updated_at();

CREATE OR REPLACE FUNCTION generate_insurance_policy_number()
RETURNS TRIGGER AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  IF NEW.policy_number IS NULL THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(policy_number, '\D', '', 'g'), '')::INTEGER), 0) + 1
      INTO next_seq
      FROM insurance_policies
      WHERE organization_id = NEW.organization_id;
    NEW.policy_number := 'APL-' || lpad(next_seq::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insurance_policy_number ON insurance_policies;
CREATE TRIGGER trg_insurance_policy_number
  BEFORE INSERT ON insurance_policies
  FOR EACH ROW EXECUTE FUNCTION generate_insurance_policy_number();

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS insurance_policy_id UUID REFERENCES insurance_policies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_financial_entries_insurance_policy ON financial_entries (insurance_policy_id);

COMMENT ON TABLE insurance_policies IS
  'Vertical Seguros (Fase 3) — apólice emitida a partir de uma cotação aprovada (ou direto). policy_number auto-gerado (APL-000001), mesmo padrão de properties.code.';
