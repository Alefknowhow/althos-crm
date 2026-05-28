-- Bloco Clientes (Customers)
--
-- Conceitualmente um cliente é um lead que comprou. Em vez de duplicar dados
-- em tabela separada, marcamos `leads.is_customer = true` (auto-trigger
-- quando a primeira venda é registrada, ou manualmente pelo operador) e
-- mantemos os campos extras (endereço, documentos) numa tabela 1:1
-- `customer_profiles`. Documentos enviados ficam em `customer_documents` +
-- bucket privado de Storage.

-- 1) Flag + timestamp em leads.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS is_customer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS became_customer_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_org_is_customer
  ON leads (organization_id, is_customer)
  WHERE is_customer = TRUE;

-- 2) Profile (1:1 with lead). Campos brasileiros típicos.
CREATE TABLE IF NOT EXISTS customer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Documents (sensitive — RLS only).
    cpf TEXT,
    rg TEXT,
    date_of_birth DATE,

    -- Address.
    postal_code TEXT,     -- CEP
    street TEXT,
    number TEXT,
    complement TEXT,      -- apto, bloco, etc.
    district TEXT,        -- bairro
    city TEXT,
    state TEXT,           -- UF
    country TEXT DEFAULT 'BR',

    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_org
  ON customer_profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_city
  ON customer_profiles (organization_id, city);

-- 3) Documents uploaded for the customer (RG/CPF scans, address proof, etc).
-- The file itself lives in Storage; we keep the metadata + path here.
CREATE TABLE IF NOT EXISTS customer_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('cpf_front','cpf_back','rg_front','rg_back','address_proof','contract','other')),
    file_path TEXT NOT NULL,   -- path inside the bucket
    file_name TEXT NOT NULL,
    file_size_bytes INTEGER,
    mime_type TEXT,
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_documents_profile
  ON customer_documents (customer_profile_id);

-- 4) RLS for all three things.
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer profiles access" ON customer_profiles;
CREATE POLICY "Customer profiles access" ON customer_profiles FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "Customer documents access" ON customer_documents;
CREATE POLICY "Customer documents access" ON customer_documents FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

-- updated_at trigger on profiles.
DROP TRIGGER IF EXISTS update_customer_profiles_updated_at ON customer_profiles;
CREATE TRIGGER update_customer_profiles_updated_at
  BEFORE UPDATE ON customer_profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 5) Auto-promote lead to customer when the first completed sale is registered.
CREATE OR REPLACE FUNCTION auto_promote_to_customer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND NEW.status = 'completed' THEN
    UPDATE leads
    SET is_customer = TRUE,
        became_customer_at = COALESCE(became_customer_at, NOW()),
        updated_at = NOW()
    WHERE id = NEW.lead_id
      AND organization_id = NEW.organization_id
      AND is_customer = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sales_auto_promote_to_customer ON sales;
CREATE TRIGGER sales_auto_promote_to_customer
  AFTER INSERT OR UPDATE ON sales
  FOR EACH ROW EXECUTE PROCEDURE auto_promote_to_customer();

-- 6) Backfill: any lead that already has a completed sale becomes customer.
UPDATE leads l
SET is_customer = TRUE,
    became_customer_at = (
      SELECT MIN(created_at)
      FROM sales s
      WHERE s.lead_id = l.id AND s.status = 'completed'
    )
WHERE l.is_customer = FALSE
  AND EXISTS (
    SELECT 1 FROM sales s
    WHERE s.lead_id = l.id AND s.status = 'completed'
  );

-- 7) Private Storage bucket for customer documents (RLS gates everything).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-documents',
  'customer-documents',
  FALSE,  -- PRIVATE — sensitive docs
  10 * 1024 * 1024,
  ARRAY['image/png','image/jpeg','image/jpg','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket policies: path layout `{org_id}/{customer_profile_id}/{filename}`.
-- Only members of the org can read; only same can write/update/delete.
DROP POLICY IF EXISTS "Customer docs read own org" ON storage.objects;
CREATE POLICY "Customer docs read own org" ON storage.objects FOR SELECT
USING (
  bucket_id = 'customer-documents'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Customer docs write own org" ON storage.objects;
CREATE POLICY "Customer docs write own org" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'customer-documents'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Customer docs update own org" ON storage.objects;
CREATE POLICY "Customer docs update own org" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'customer-documents'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Customer docs delete own org" ON storage.objects;
CREATE POLICY "Customer docs delete own org" ON storage.objects FOR DELETE
USING (
  bucket_id = 'customer-documents'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);
