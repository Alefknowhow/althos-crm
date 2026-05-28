-- Bloco AI Analyst (Insights)
-- Persistent chat history for the "ask your data" analyst agent. Per-user
-- (each user has their own conversations) but org-scoped so RLS can still
-- gate access. Tool calls + their outputs are stored as JSONB on the
-- assistant message so we can re-render charts/tables on session reload.

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
    content TEXT NOT NULL,
    -- Array of { name, input, output_json } captured during tool use, so the
    -- UI can re-render chart/table cards exactly as the user first saw them
    -- when they reload an old conversation.
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

-- RLS — sessions only visible to their owner, messages by session FK trail.
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

DROP TRIGGER IF EXISTS update_ai_insights_sessions_updated_at ON ai_insights_sessions;
CREATE TRIGGER update_ai_insights_sessions_updated_at
  BEFORE UPDATE ON ai_insights_sessions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
