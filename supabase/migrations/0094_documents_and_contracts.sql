-- ---------------------------------------------------------------------
-- Gerador de Documentos — biblioteca de templates (MEDIF, autorização de
-- menor viajando, declarações etc.) com campos `{{chave}}` preenchidos
-- manualmente na hora de gerar (sem auto-preenchimento a partir do
-- contato — muitos desses documentos são para pessoas que nem estão
-- cadastradas no CRM, ex.: responsável legal de um menor).
-- ---------------------------------------------------------------------

CREATE TABLE public.document_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  category           TEXT,
  body_html          TEXT NOT NULL DEFAULT '',
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_templates_org ON public.document_templates (organization_id);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Document templates access" ON public.document_templates
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access" ON public.document_templates
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE POLICY "Super admin update" ON public.document_templates
  FOR UPDATE USING ((SELECT is_super_admin()));

-- ---------------------------------------------------------------------
-- Documentos gerados — snapshot do conteúdo já resolvido (o template
-- pode mudar depois; o documento gerado não deve mudar retroativamente).
-- ---------------------------------------------------------------------

CREATE TABLE public.generated_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id        UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
  title              TEXT NOT NULL,
  body_html          TEXT NOT NULL,
  field_values       JSONB NOT NULL DEFAULT '{}',
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_documents_org ON public.generated_documents (organization_id);

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Generated documents access" ON public.generated_documents
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access" ON public.generated_documents
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE POLICY "Super admin update" ON public.generated_documents
  FOR UPDATE USING ((SELECT is_super_admin()));

-- ---------------------------------------------------------------------
-- Contratos Inteligentes — checklist fixo do fluxo da venda. "Venda
-- registrada" já existe via travel_sales.created_at; as 7 colunas abaixo
-- cobrem o restante do fluxo. NULL = etapa pendente.
-- ---------------------------------------------------------------------

ALTER TABLE public.travel_sales
  ADD COLUMN IF NOT EXISTS contrato_gerado_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contrato_assinado_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voucher_entregue_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS documentacao_enviada_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS embarque_realizado_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posvenda_concluido_at     TIMESTAMPTZ;
