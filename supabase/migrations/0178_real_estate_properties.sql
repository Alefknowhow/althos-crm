-- Vertical Imobiliárias — Fase 1: cadastro de imóveis.
--
-- Segue a mesma arquitetura Core já usada por Viagens/Clínicas: entidade
-- própria (properties), campos comuns tipados + `features` jsonb pra
-- características extensíveis (evita "centenas de booleanos" fixos —
-- mesmo espírito do `data` jsonb de quotation_products), mídia como
-- referência de Storage (nunca binário no Postgres), proprietário via FK
-- direta pra `contatos` (sem entidade nova, reaproveita Contato do Core).

CREATE TABLE IF NOT EXISTS properties (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code                TEXT,
    title               TEXT NOT NULL DEFAULT '',
    property_type       TEXT,
    purpose             TEXT NOT NULL DEFAULT 'venda' CHECK (purpose IN ('venda', 'locacao', 'venda_locacao')),
    status              TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'reservado', 'em_negociacao', 'vendido', 'alugado', 'indisponivel')),
    price_cents         BIGINT,
    condo_fee_cents     BIGINT,
    iptu_cents          BIGINT,
    address_street      TEXT,
    address_number      TEXT,
    address_complement  TEXT,
    neighborhood        TEXT,
    city                TEXT,
    state               TEXT,
    zip                 TEXT,
    lat                 DOUBLE PRECISION,
    lng                 DOUBLE PRECISION,
    bedrooms            INTEGER,
    suites              INTEGER,
    bathrooms           INTEGER,
    parking_spots       INTEGER,
    area_built          NUMERIC,
    area_total          NUMERIC,
    area_useful         NUMERIC,
    floor               TEXT,
    rooms_count         INTEGER,
    features            JSONB NOT NULL DEFAULT '[]'::jsonb,
    description_html    TEXT,
    owner_contato_id    UUID REFERENCES contatos(id) ON DELETE SET NULL,
    broker_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    capture_source      TEXT,
    is_exclusive        BOOLEAN NOT NULL DEFAULT FALSE,
    exclusivity_until   DATE,
    commission_percent  NUMERIC,
    internal_notes      TEXT,
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_org ON properties (organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties (organization_id, city);
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_code ON properties (organization_id, code);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Properties access" ON properties;
CREATE POLICY "Properties access" ON properties
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Properties super admin" ON properties;
CREATE POLICY "Properties super admin" ON properties
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE properties IS
  'Imóveis da vertical Imobiliárias (Fase 1: cadastro). features é jsonb (array de strings) pra características extensíveis sem migração de schema.';
COMMENT ON COLUMN properties.features IS
  'Array de strings livres (ex.: ["piscina","churrasqueira","mobiliado"]) — catálogo sugerido na UI, não travado em enum.';

-- ── Código comercial automático (ALT-000001, sequencial por organização) ──
CREATE OR REPLACE FUNCTION generate_property_code()
RETURNS TRIGGER AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  IF NEW.code IS NULL THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\D', '', 'g'), '')::INTEGER), 0) + 1
      INTO next_seq
      FROM properties
      WHERE organization_id = NEW.organization_id;
    NEW.code := 'ALT-' || lpad(next_seq::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_code ON properties;
CREATE TRIGGER trg_property_code
  BEFORE INSERT ON properties
  FOR EACH ROW EXECUTE FUNCTION generate_property_code();

CREATE OR REPLACE FUNCTION set_property_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_updated_at ON properties;
CREATE TRIGGER trg_property_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_property_updated_at();

-- ── Mídia do imóvel (fotos/vídeos/documentos) — referência de Storage ──
CREATE TABLE IF NOT EXISTS property_media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    storage_key     TEXT NOT NULL,
    media_type      TEXT NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo', 'video', 'document')),
    label           TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_cover        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_media_property ON property_media (property_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_property_media_org ON property_media (organization_id);

ALTER TABLE property_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property media access" ON property_media;
CREATE POLICY "Property media access" ON property_media
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Property media super admin" ON property_media;
CREATE POLICY "Property media super admin" ON property_media
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE property_media IS
  'Fotos/vídeos/documentos de um imóvel — storage_key aponta pro Storage existente (lib/storage), nunca binário no Postgres.';
