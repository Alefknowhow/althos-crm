-- ---------------------------------------------------------------------
-- MEDIF (Medical Information Form) — documento extenso e específico
-- (7 páginas, dezenas de campos em várias seções: passageiro, médico,
-- diagnóstico, sinais vitais, condição cardíaca/pulmonar/psiquiátrica,
-- declaração de acompanhante PNAE). Diferente demais do gerador de
-- documentos genérico (`document_templates`) pra caber no mesmo modelo
-- de `{{campo}}` — os dados vão em `data jsonb`, organizados por seção
-- (ver `lib/medif/schema.ts`), servindo como registro/consulta no CRM.
--
-- O PDF em si (formulário oficial da operadora/companhia aérea, que
-- precisa de assinatura física do médico/passageiro) NÃO é gerado pelo
-- sistema — fica disponível só para download como modelo em branco.
-- ---------------------------------------------------------------------

CREATE TABLE public.medif_records (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contato_id         UUID REFERENCES public.contatos(id) ON DELETE SET NULL,
  passenger_name     TEXT,
  data               JSONB NOT NULL DEFAULT '{}',
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_medif_records_org     ON public.medif_records (organization_id);
CREATE INDEX idx_medif_records_contato ON public.medif_records (contato_id);

ALTER TABLE public.medif_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medif records access" ON public.medif_records
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access" ON public.medif_records
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE POLICY "Super admin update" ON public.medif_records
  FOR UPDATE USING ((SELECT is_super_admin()));

-- ---------------------------------------------------------------------
-- Modelo MEDIF em branco (PDF oficial da operadora) — um por
-- organização, disponibilizado só para download.
-- ---------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS medif_template_path TEXT,
  ADD COLUMN IF NOT EXISTS medif_template_name TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('medif-templates', 'medif-templates', FALSE, 15 * 1024 * 1024, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Medif templates read own org" ON storage.objects;
CREATE POLICY "Medif templates read own org" ON storage.objects FOR SELECT
USING (
  bucket_id = 'medif-templates'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Medif templates write own org" ON storage.objects;
CREATE POLICY "Medif templates write own org" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'medif-templates'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Medif templates update own org" ON storage.objects;
CREATE POLICY "Medif templates update own org" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'medif-templates'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "Medif templates delete own org" ON storage.objects;
CREATE POLICY "Medif templates delete own org" ON storage.objects FOR DELETE
USING (
  bucket_id = 'medif-templates'
  AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
);
