-- Contratos de assinatura de plano (Agências de Tráfego) — tabela própria,
-- não compartilhada com sale_contracts (Reservas/Viagens). Mesma estrutura,
-- copiada, mas vínculo direto com a venda genérica (sales), sem coluna dupla
-- nem CHECK de exclusividade.

CREATE TABLE IF NOT EXISTS plan_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'signed'::text, 'rejected'::text])),
  pdf_path TEXT,
  signed_pdf_path TEXT,
  autentique_document_id TEXT,
  signature_link TEXT,
  signer_name TEXT,
  signer_email TEXT,
  signer_phone TEXT,
  signer2_name TEXT,
  signer2_email TEXT,
  signer2_phone TEXT,
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_contracts_sale ON plan_contracts(sale_id);
CREATE INDEX IF NOT EXISTS idx_plan_contracts_org ON plan_contracts(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_contracts_autentique_doc ON plan_contracts(autentique_document_id) WHERE autentique_document_id IS NOT NULL;

ALTER TABLE plan_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_contracts_org_access" ON plan_contracts
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('plan-contracts', 'plan-contracts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "plan_contracts_storage_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'plan-contracts' AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations()));

CREATE POLICY "plan_contracts_storage_write" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'plan-contracts' AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations()));

CREATE POLICY "plan_contracts_storage_update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'plan-contracts' AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations()));

CREATE POLICY "plan_contracts_storage_delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'plan-contracts' AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations()));

-- Reverte a extensão de sale_contracts feita antes — Reservas (Viagens) e
-- Planos (Tráfego) passam a ter tabelas de contrato totalmente separadas.
ALTER TABLE sale_contracts DROP CONSTRAINT IF EXISTS sale_contracts_exactly_one_sale;
DELETE FROM sale_contracts WHERE sale_id IS NULL;
ALTER TABLE sale_contracts ALTER COLUMN sale_id SET NOT NULL;
DROP INDEX IF EXISTS idx_sale_contracts_sales_generic;
ALTER TABLE sale_contracts DROP COLUMN IF EXISTS sales_generic_id;

COMMENT ON TABLE plan_contracts IS
  'Agências de Tráfego — contrato de assinatura de plano (Autentique). Tabela própria, copiada de sale_contracts, não compartilhada.';
