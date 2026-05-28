-- Performance indexes (idempotent).
-- Targets the slow paths identified in tier-1 capacity review.

-- Lead lookup by email (used in public form submission to dedupe leads).
CREATE INDEX IF NOT EXISTS idx_leads_org_email ON leads (organization_id, email);

-- Lead listing/filtering ordered by created_at.
CREATE INDEX IF NOT EXISTS idx_leads_org_created_at ON leads (organization_id, created_at DESC);

-- Form submissions ordered per form (drives /respostas page).
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_created
  ON form_submissions (form_id, created_at DESC);

-- JSONB GIN indexes so meta/data filters hit an index.
CREATE INDEX IF NOT EXISTS idx_form_submissions_meta_gin
  ON form_submissions USING gin (meta jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_form_submissions_data_gin
  ON form_submissions USING gin (data jsonb_path_ops);

-- Lead activities timeline (drives lead detail page).
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_created
  ON lead_activities (lead_id, created_at DESC);

-- Automation runs by automation (drives /automacoes "runs this month" count).
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_created
  ON automation_runs (automation_id, created_at DESC);

-- Tasks by org/status/due_date (drives sidebar overdue badge + tarefas page).
CREATE INDEX IF NOT EXISTS idx_tasks_org_status_due
  ON tasks (organization_id, status, due_date);

-- Denormalized UTM columns on form_submissions, populated by submitPublicForm.
ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

CREATE INDEX IF NOT EXISTS idx_form_submissions_utm_source ON form_submissions (utm_source);
CREATE INDEX IF NOT EXISTS idx_form_submissions_utm_campaign ON form_submissions (utm_campaign);

-- Backfill from meta JSONB for existing rows.
UPDATE form_submissions
SET
  utm_source = COALESCE(utm_source, meta->>'utm_source'),
  utm_medium = COALESCE(utm_medium, meta->>'utm_medium'),
  utm_campaign = COALESCE(utm_campaign, meta->>'utm_campaign')
WHERE meta IS NOT NULL
  AND (utm_source IS NULL OR utm_medium IS NULL OR utm_campaign IS NULL);
