-- ---------------------------------------------------------------------------
-- 0048_automation_step_logs
--
-- Tracks the outcome of each individual step within an automation run.
-- Used to power the Sucessos / Erros counters shown in the FlowNode cards.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.automation_step_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id   UUID        NOT NULL REFERENCES public.automations(id)   ON DELETE CASCADE,
  run_id          UUID        NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  step_index      INTEGER     NOT NULL,
  step_type       TEXT        NOT NULL,
  status          TEXT        NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  message         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Efficient aggregation query: count per (automation_id, step_index, status)
CREATE INDEX IF NOT EXISTS idx_step_logs_automation_step
  ON public.automation_step_logs (automation_id, step_index, status);

CREATE INDEX IF NOT EXISTS idx_step_logs_run
  ON public.automation_step_logs (run_id);

-- RLS
ALTER TABLE public.automation_step_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_step_logs"
  ON public.automation_step_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );
