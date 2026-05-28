-- Safeguard: ensure AI Insights tables exist even if migration 0034 was skipped.
-- All statements are idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS ai_insights_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_sessions_user
  ON ai_insights_sessions (organization_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_insights_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES ai_insights_sessions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content TEXT NOT NULL DEFAULT '',
    tool_calls JSONB,
    tokens_input INTEGER,
    tokens_output INTEGER,
    cache_read_tokens INTEGER,
    cost_cents INTEGER,
    model TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_messages_session_created
  ON ai_insights_messages (session_id, created_at);

-- RLS (idempotent)
ALTER TABLE ai_insights_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AI insights sessions access" ON ai_insights_sessions;
CREATE POLICY "AI insights sessions access" ON ai_insights_sessions FOR ALL
USING (
  organization_id IN (SELECT get_user_organizations())
  AND user_id = auth.uid()
)
WITH CHECK (
  organization_id IN (SELECT get_user_organizations())
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS "AI insights messages access" ON ai_insights_messages;
CREATE POLICY "AI insights messages access" ON ai_insights_messages FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

-- Ensure form_submissions has UTM columns (idempotent — needed if 0024 was skipped).
ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

CREATE INDEX IF NOT EXISTS idx_form_submissions_utm_source   ON form_submissions (utm_source);
CREATE INDEX IF NOT EXISTS idx_form_submissions_utm_campaign ON form_submissions (utm_campaign);

-- Backfill UTM from existing meta JSONB (only rows that have meta but no utm columns yet).
UPDATE form_submissions
SET
  utm_source   = COALESCE(utm_source,   meta->>'utm_source'),
  utm_medium   = COALESCE(utm_medium,   meta->>'utm_medium'),
  utm_campaign = COALESCE(utm_campaign, meta->>'utm_campaign')
WHERE meta IS NOT NULL
  AND (utm_source IS NULL OR utm_medium IS NULL OR utm_campaign IS NULL);
