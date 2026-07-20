-- ---------------------------------------------------------------------
-- Ajustes de Reservas: contrato editável, novos campos da venda,
-- checklist reduzido a 5 etapas fixas, tarefas vinculadas à reserva, e
-- generalização do upload de modelos de documento (MEDIF/FREMEC).
-- ---------------------------------------------------------------------

-- Contrato padrão da agência (template editável, category='contrato').
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS contract_template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL;

-- Novos campos de texto livre na venda — só aparecem nos documentos
-- gerados (voucher/contrato) quando preenchidos.
ALTER TABLE public.travel_sales
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,
  ADD COLUMN IF NOT EXISTS important_info       TEXT,
  ADD COLUMN IF NOT EXISTS service_info          TEXT;

-- Checklist reduzido: remove as etapas que a agência não usa.
ALTER TABLE public.travel_sales
  DROP COLUMN IF EXISTS pagamento_confirmado_at,
  DROP COLUMN IF EXISTS documentacao_enviada_at;

-- Tarefas vinculadas à reserva de origem (hoje só linkavam ao contato).
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.travel_sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_sale_id ON public.tasks (sale_id);

-- ---------------------------------------------------------------------
-- Modelos de documento em PDF pra download (MEDIF, FREMEC, e futuros) —
-- generaliza as colunas fixas medif_template_path/name em organizations
-- pra uma tabela pequena, um registro por tipo de documento.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attachment_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type      TEXT NOT NULL CHECK (document_type IN ('medif', 'fremec')),
  path               TEXT NOT NULL,
  name               TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_attachment_templates_org ON public.attachment_templates (organization_id);

ALTER TABLE public.attachment_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attachment templates access" ON public.attachment_templates
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access" ON public.attachment_templates
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE POLICY "Super admin update" ON public.attachment_templates
  FOR UPDATE USING ((SELECT is_super_admin()));

-- Backfill: migra o que já foi enviado como modelo MEDIF (coluna antiga)
-- pra tabela nova, preservando o arquivo já enviado pelo usuário.
INSERT INTO public.attachment_templates (organization_id, document_type, path, name)
SELECT id, 'medif', medif_template_path, COALESCE(medif_template_name, 'MEDIF.pdf')
FROM public.organizations
WHERE medif_template_path IS NOT NULL
ON CONFLICT (organization_id, document_type) DO NOTHING;

-- Reaproveita o bucket já existente 'medif-templates' pros dois tipos de
-- documento (path já é prefixado por org_id, então a RLS de storage já
-- criada continua válida sem mudança).

-- Remove definitivamente medif_records (o registro estruturado deixa de
-- existir — fica só o upload/download do modelo + texto informativo).
DROP TABLE IF EXISTS public.medif_records;

-- Remove as colunas antigas de organizations (substituídas por
-- attachment_templates).
ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS medif_template_path,
  DROP COLUMN IF EXISTS medif_template_name;
