-- ---------------------------------------------------------------------
-- Orçamento IA — orçamento institucional/técnico gerado a partir de um
-- documento (imagem/PDF) lido por IA, deliberadamente mais simples e plano
-- que o modelo rico de Cotações (travel_proposals + tabelas-filhas): sem
-- hospedagens/voos/roteiro estruturados, só os campos de um orçamento
-- formal (cliente, destino, valores, condições de pagamento, validade).
-- Sem link público nesta leva — impressão só autenticada dentro do app.
-- ---------------------------------------------------------------------

CREATE TABLE public.budget_documents (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contato_id             UUID REFERENCES public.contatos(id) ON DELETE SET NULL,
  client_name            TEXT,
  destination            TEXT,
  hotel_name             TEXT,
  start_date             DATE,
  end_date               DATE,
  pax_adults             INTEGER,
  pax_children           INTEGER,
  included               TEXT[] NOT NULL DEFAULT '{}',
  not_included           TEXT[] NOT NULL DEFAULT '{}',
  -- [{label, value}], mesmo formato de travel_proposals.payment_conditions
  payment_conditions     JSONB NOT NULL DEFAULT '[]',
  total_cents            INTEGER NOT NULL DEFAULT 0,
  price_per_person_cents INTEGER,
  validity_days          INTEGER NOT NULL DEFAULT 7,
  operadora              TEXT,
  observacoes            TEXT,
  -- {path, name, mime_type} — arquivo original enviado (bucket privado
  -- budget-documents), guardado pra referência/auditoria da extração.
  origem_arquivo         JSONB,
  -- Saída bruta da extração por IA, guardada pra referência/depuração.
  extracted_data         JSONB,
  status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'sent')),
  created_by             UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_documents_org      ON public.budget_documents (organization_id);
CREATE INDEX idx_budget_documents_contato  ON public.budget_documents (contato_id);

ALTER TABLE public.budget_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Budget documents access" ON public.budget_documents
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access" ON public.budget_documents
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE POLICY "Super admin update" ON public.budget_documents
  FOR UPDATE USING ((SELECT is_super_admin()));

-- ---------------------------------------------------------------------
-- Bucket privado para o arquivo original (imagem/PDF) de cada orçamento.
-- Path layout: `{org_id}/{budget_id}/{filename}`. Leitura via signed URL.
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'budget-documents',
  'budget-documents',
  FALSE,
  15 * 1024 * 1024,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Budget documents read own org" ON storage.objects;
CREATE POLICY "Budget documents read own org" ON storage.objects FOR SELECT
USING (
  bucket_id = 'budget-documents'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Budget documents write own org" ON storage.objects;
CREATE POLICY "Budget documents write own org" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'budget-documents'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Budget documents update own org" ON storage.objects;
CREATE POLICY "Budget documents update own org" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'budget-documents'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Budget documents delete own org" ON storage.objects;
CREATE POLICY "Budget documents delete own org" ON storage.objects FOR DELETE
USING (
  bucket_id = 'budget-documents'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);
