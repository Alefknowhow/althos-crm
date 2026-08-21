CREATE TABLE IF NOT EXISTS insurance_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_products_org ON insurance_products (organization_id);

ALTER TABLE insurance_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insurance products access" ON insurance_products
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Insurance products super admin" ON insurance_products
  FOR ALL USING ((SELECT is_super_admin()));

CREATE TABLE IF NOT EXISTS insurers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    cnpj              TEXT,
    contact_name      TEXT,
    contact_phone     TEXT,
    contact_email     TEXT,
    conditions        TEXT,
    logo_storage_key  TEXT,
    internal_notes    TEXT,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurers_org ON insurers (organization_id);

ALTER TABLE insurers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insurers access" ON insurers
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Insurers super admin" ON insurers
  FOR ALL USING ((SELECT is_super_admin()));

CREATE OR REPLACE FUNCTION set_insurance_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_insurance_products_updated_at
  BEFORE UPDATE ON insurance_products
  FOR EACH ROW EXECUTE FUNCTION set_insurance_updated_at();

CREATE TRIGGER trg_insurers_updated_at
  BEFORE UPDATE ON insurers
  FOR EACH ROW EXECUTE FUNCTION set_insurance_updated_at();

COMMENT ON TABLE insurance_products IS
  'Vertical Seguros (Fase 1) — catálogo extensível de tipos de seguro (Auto/Residencial/Vida/etc), texto livre, sem enum travado.';
COMMENT ON TABLE insurers IS
  'Vertical Seguros (Fase 1) — seguradoras parceiras da corretora. logo_storage_key aponta pro Storage existente (URL pública, mesmo padrão de property_media.storage_key).';
