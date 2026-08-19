-- Fase 1 do sistema de Backup & Disaster Recovery (ver
-- docs/backup-disaster-recovery.md). Puramente aditivo — três tabelas
-- de sistema, nenhuma tabela existente é alterada.
--
-- Todas são dado de SISTEMA, não de tenant (quem faz backup enxerga
-- todas as orgs por definição) — RLS restringe a super-admin, sem
-- policy de isolamento por organization_id (mesmo padrão de
-- system_alerts/super_admin_audit_log).
CREATE TABLE IF NOT EXISTS public.backup_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  TEXT NOT NULL CHECK (type IN ('database', 'storage')),
  status                TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'invalid')),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  duration_ms           INTEGER,
  manifest_key          TEXT,
  database_size_bytes   BIGINT,
  storage_object_count  INTEGER,
  storage_bytes         BIGINT,
  checksum              TEXT,
  error_message         TEXT,
  triggered_by          TEXT NOT NULL DEFAULT 'cron' CHECK (triggered_by IN ('cron', 'manual')),
  triggered_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_backup_runs_type_started ON public.backup_runs (type, started_at DESC);

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_runs_super_admin" ON public.backup_runs FOR ALL USING ((SELECT is_super_admin()));

-- Nunca marcar status='success' se a verificação de checksum falhar —
-- 'invalid' existe exatamente pra esse caso (regra explícita do plano
-- de backup: um backup não-verificado não é confiável).
CREATE TABLE IF NOT EXISTS public.backup_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event             TEXT NOT NULL CHECK (event IN (
                      'backup_created', 'backup_verified', 'backup_failed', 'backup_deleted',
                      'restore_started', 'restore_completed', 'restore_failed',
                      'tenant_restore_started', 'tenant_restore_completed', 'object_restore_completed'
                    )),
  backup_run_id     UUID REFERENCES public.backup_runs(id) ON DELETE SET NULL,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id   UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_backup_audit_log_created ON public.backup_audit_log (created_at DESC);

ALTER TABLE public.backup_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_audit_log_super_admin" ON public.backup_audit_log FOR ALL USING ((SELECT is_super_admin()));

-- Cursor incremental do backup de storage: ETag do último objeto
-- copiado pro bucket de backup, pra não recopiar o que não mudou.
CREATE TABLE IF NOT EXISTS public.backup_object_state (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key       TEXT NOT NULL,
  bucket            TEXT NOT NULL,
  organization_id   UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  etag              TEXT,
  backed_up_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bucket, storage_key)
);

CREATE INDEX IF NOT EXISTS idx_backup_object_state_org ON public.backup_object_state (organization_id);

ALTER TABLE public.backup_object_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_object_state_super_admin" ON public.backup_object_state FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE public.backup_runs IS 'Registro de cada execução de backup (banco ou storage) — Fase 1 do sistema de Backup/DR. Dado de sistema, não de tenant — só super-admin acessa.';
COMMENT ON TABLE public.backup_audit_log IS 'Audit trail de eventos de backup/restore. Nunca registra secrets.';
COMMENT ON TABLE public.backup_object_state IS 'Cursor incremental do backup de storage — ETag do último objeto copiado, evita recopiar o que não mudou.';
