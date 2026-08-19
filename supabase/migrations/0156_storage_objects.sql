-- ---------------------------------------------------------------------
-- Fase 8 da migração de Storage pra Cloudflare R2: tabela de metadados
-- unificada, provider-agnostic. Puramente aditiva — nenhuma tabela ou
-- bucket existente é alterado, nenhum dado é movido. Os 12 buckets do
-- Supabase Storage (whatsapp-media, instagram-media, form-assets,
-- contato-avatars, financial-attachments, budget-documents,
-- customer-documents, org-logos, whatsapp-assets, email-assets,
-- medif-templates, sale-contracts) continuam funcionando exatamente
-- como hoje. Esta tabela é o destino da PRÓXIMA fase (Storage Service),
-- ainda não usada por nenhum código.
--
-- storage_provider permite o modelo híbrido descrito no plano de
-- migração: arquivo novo pode ir pro R2, arquivo antigo continua
-- 'supabase' até ser migrado explicitamente (fase futura, com dry-run).
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.storage_objects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Referências genéricas — sem FK porque podem apontar pra
  -- whatsapp_conversations OU social_conversations (tabelas distintas),
  -- e o objeto pode não estar ligado a nenhuma conversa (avatar, logo,
  -- documento financeiro). Preenchido pelo caller quando fizer sentido.
  conversation_id   UUID,
  message_id        UUID,

  storage_provider  TEXT NOT NULL DEFAULT 'supabase'
                      CHECK (storage_provider IN ('supabase', 'r2', 's3', 'b2')),
  bucket            TEXT NOT NULL,
  storage_key       TEXT NOT NULL,      -- caminho interno do objeto no provider

  filename          TEXT,
  mime_type         TEXT,
  size_bytes        BIGINT,
  checksum          TEXT,
  width             INTEGER,
  height            INTEGER,
  duration_seconds  NUMERIC,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (storage_provider, bucket, storage_key)
);

CREATE INDEX IF NOT EXISTS idx_storage_objects_org          ON public.storage_objects (organization_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_conversation  ON public.storage_objects (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_storage_objects_message       ON public.storage_objects (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_storage_objects_provider      ON public.storage_objects (storage_provider, status);

ALTER TABLE public.storage_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storage_objects_org_isolation" ON public.storage_objects
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "storage_objects_super_admin" ON public.storage_objects
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE TRIGGER trg_storage_objects_updated_at
  BEFORE UPDATE ON public.storage_objects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.storage_objects IS
  'Metadados unificados de arquivo, provider-agnostic (Fase 8 da migração pra R2). Ainda não consumida por nenhuma action — os buckets legados do Supabase Storage continuam sendo a fonte de verdade até a Storage Service (Fase 2) ser implementada.';
