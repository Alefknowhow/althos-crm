-- Integração Autentique: cada organização guarda sua própria chave de API
-- (bring-your-own-key) e os contratos gerados/enviados para assinatura
-- ficam registrados por venda (travel_sales), com o PDF salvo em Storage.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS autentique_api_key TEXT;

CREATE TABLE IF NOT EXISTS sale_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES travel_sales(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'signed'::text, 'rejected'::text])),
  pdf_path TEXT,
  signed_pdf_path TEXT,
  autentique_document_id TEXT,
  signature_link TEXT,
  signer_name TEXT,
  signer_email TEXT,
  signer_phone TEXT,
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_contracts_sale ON sale_contracts(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_contracts_org ON sale_contracts(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_contracts_autentique_doc ON sale_contracts(autentique_document_id) WHERE autentique_document_id IS NOT NULL;

ALTER TABLE sale_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_contracts_org_access" ON sale_contracts
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('sale-contracts', 'sale-contracts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "sale_contracts_storage_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'sale-contracts' AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations()));

CREATE POLICY "sale_contracts_storage_write" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'sale-contracts' AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations()));

CREATE POLICY "sale_contracts_storage_update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'sale-contracts' AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations()));

CREATE POLICY "sale_contracts_storage_delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'sale-contracts' AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations()));
