-- 0063: Vitrine (showcase) — pacotes de viagem prontos, exibidos publicamente
-- por nicho de agências de viagens. Espelha travel_proposals porém SEM campos
-- de cliente; adiciona youtube_url, category (classificação) e cover_photos.

-- Token público da vitrine por organização (página pública compartilhável)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vitrine_token TEXT;
UPDATE organizations SET vitrine_token = encode(gen_random_bytes(9), 'hex') WHERE vitrine_token IS NULL;
ALTER TABLE organizations ALTER COLUMN vitrine_token SET DEFAULT encode(gen_random_bytes(9), 'hex');
CREATE UNIQUE INDEX IF NOT EXISTS organizations_vitrine_token_key ON organizations (vitrine_token);

CREATE TABLE IF NOT EXISTS travel_showcase_packages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by             UUID,
  title                  TEXT,
  category               TEXT,
  youtube_url            TEXT,
  briefing               TEXT,
  cover_photos           JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published           BOOLEAN NOT NULL DEFAULT TRUE,
  start_date             DATE,
  end_date               DATE,
  destinations           JSONB NOT NULL DEFAULT '[]'::jsonb,
  flights                JSONB NOT NULL DEFAULT '[]'::jsonb,
  hotels                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  services               JSONB NOT NULL DEFAULT '{}'::jsonb,
  included               JSONB NOT NULL DEFAULT '[]'::jsonb,
  not_included           JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_bumps            JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cents            INTEGER NOT NULL DEFAULT 0,
  pax_count              INTEGER,
  price_per_person_cents INTEGER,
  payment                JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS travel_showcase_packages_org_idx ON travel_showcase_packages (organization_id);
CREATE INDEX IF NOT EXISTS travel_showcase_packages_category_idx ON travel_showcase_packages (category);

ALTER TABLE travel_showcase_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Travel showcase access" ON travel_showcase_packages;
CREATE POLICY "Travel showcase access" ON travel_showcase_packages
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "Super admin access travel_showcase_packages" ON travel_showcase_packages;
CREATE POLICY "Super admin access travel_showcase_packages" ON travel_showcase_packages
  FOR SELECT
  USING (is_super_admin());

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION set_travel_showcase_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS travel_showcase_set_updated_at ON travel_showcase_packages;
CREATE TRIGGER travel_showcase_set_updated_at
  BEFORE UPDATE ON travel_showcase_packages
  FOR EACH ROW EXECUTE FUNCTION set_travel_showcase_updated_at();
