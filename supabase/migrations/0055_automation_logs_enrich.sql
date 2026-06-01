-- ---------------------------------------------------------------------------
-- 0055_automation_logs_enrich
--
-- Enriches the existing automation observability tables so the
-- /automacoes/logs page can show full execution timelines:
--   * per-step timing (started_at / completed_at / duration_ms)
--   * payload recebido (trigger) e payload enviado (por step)
--   * stack trace em falhas
--
-- Also adds the missing `error` column to automation_runs (the engine already
-- writes it on failure, but the column was dropped in an earlier repair, so the
-- update was silently failing).
-- ---------------------------------------------------------------------------

-- automation_runs: error message + payload recebido no gatilho
ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS error           TEXT,
  ADD COLUMN IF NOT EXISTS trigger_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

-- automation_step_logs: timing + metadados (payload enviado, stack trace, retries)
ALTER TABLE public.automation_step_logs
  ADD COLUMN IF NOT EXISTS started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_ms   INTEGER,
  ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- The logs list is "this org's runs, newest first, optionally filtered by
-- automation". A composite index serves both the unfiltered list (prefix on
-- organization_id) and the per-automation filter.
CREATE INDEX IF NOT EXISTS idx_automation_runs_org_started
  ON public.automation_runs (organization_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_runs_org_automation_started
  ON public.automation_runs (organization_id, automation_id, started_at DESC);

-- Filtering by lead (timeline of one lead's automations).
CREATE INDEX IF NOT EXISTS idx_automation_runs_org_lead
  ON public.automation_runs (organization_id, lead_id);
