-- ---------------------------------------------------------------------
-- Módulo Financeiro — lançamentos de receita/despesa da agência. `tipo` é
-- deliberadamente binário (receita/despesa); casos como comissão ou
-- reembolso são apenas uma `categoria` livre dentro de um dos dois tipos,
-- em vez de uma enumeração fechada que nunca cobriria todos os casos.
-- ---------------------------------------------------------------------

CREATE TABLE public.financial_entries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo               TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  categoria          TEXT NOT NULL,
  subcategoria       TEXT,
  centro_custo       TEXT,
  conta_bancaria     TEXT,
  forma_pagamento    TEXT,
  valor_cents        INTEGER NOT NULL CHECK (valor_cents > 0),
  competencia        DATE NOT NULL DEFAULT CURRENT_DATE,
  vencimento         DATE,
  -- NULL = ainda em aberto (nem pago nem recebido).
  data_pagamento     DATE,
  status             TEXT NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente', 'pago', 'vencido', 'cancelado')),
  -- Cliente ou fornecedor associado ao lançamento.
  contato_id         UUID REFERENCES public.contatos(id) ON DELETE SET NULL,
  venda_id           UUID REFERENCES public.travel_sales(id) ON DELETE SET NULL,
  operadora          TEXT,
  observacoes        TEXT,
  tags               TEXT[] NOT NULL DEFAULT '{}',
  -- [{path, name, size_bytes, mime_type}] — path do bucket privado
  -- financial-attachments; leitura sempre via signed URL sob demanda.
  anexos             JSONB NOT NULL DEFAULT '[]',
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_entries_org         ON public.financial_entries (organization_id);
CREATE INDEX idx_financial_entries_contato     ON public.financial_entries (contato_id);
CREATE INDEX idx_financial_entries_venda       ON public.financial_entries (venda_id);
CREATE INDEX idx_financial_entries_competencia ON public.financial_entries (competencia);
CREATE INDEX idx_financial_entries_status      ON public.financial_entries (status);

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financial entries access" ON public.financial_entries
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access" ON public.financial_entries
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE POLICY "Super admin update" ON public.financial_entries
  FOR UPDATE USING ((SELECT is_super_admin()));

-- ---------------------------------------------------------------------
-- Bucket privado para anexos financeiros (comprovantes, notas fiscais).
-- Path layout: `{org_id}/{entry_id}/{filename}`. Leitura sempre via
-- signed URL — nunca URL pública.
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'financial-attachments',
  'financial-attachments',
  FALSE,
  15 * 1024 * 1024,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Financial attachments read own org" ON storage.objects;
CREATE POLICY "Financial attachments read own org" ON storage.objects FOR SELECT
USING (
  bucket_id = 'financial-attachments'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Financial attachments write own org" ON storage.objects;
CREATE POLICY "Financial attachments write own org" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'financial-attachments'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Financial attachments update own org" ON storage.objects;
CREATE POLICY "Financial attachments update own org" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'financial-attachments'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Financial attachments delete own org" ON storage.objects;
CREATE POLICY "Financial attachments delete own org" ON storage.objects FOR DELETE
USING (
  bucket_id = 'financial-attachments'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);
