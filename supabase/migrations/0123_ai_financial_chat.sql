-- Chat de IA analítica do módulo Financeiro. Mesmo padrão de
-- ai_insights_sessions/ai_insights_messages (copiloto da Inicial), em
-- tabelas próprias — conversa e histórico separados do copiloto geral.

CREATE TABLE IF NOT EXISTS ai_financial_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_financial_sessions_user
  ON ai_financial_sessions (organization_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_financial_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES ai_financial_sessions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    tokens_input INTEGER,
    tokens_output INTEGER,
    cache_read_tokens INTEGER,
    cost_cents INTEGER,
    model TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_financial_messages_session_created
  ON ai_financial_messages (session_id, created_at);

ALTER TABLE ai_financial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_financial_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AI financial sessions access" ON ai_financial_sessions;
CREATE POLICY "AI financial sessions access" ON ai_financial_sessions FOR ALL
USING (
  organization_id IN (SELECT get_user_organizations())
  AND user_id = auth.uid()
)
WITH CHECK (
  organization_id IN (SELECT get_user_organizations())
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS "AI financial messages access" ON ai_financial_messages;
CREATE POLICY "AI financial messages access" ON ai_financial_messages FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

DROP TRIGGER IF EXISTS update_ai_financial_sessions_updated_at ON ai_financial_sessions;
CREATE TRIGGER update_ai_financial_sessions_updated_at
  BEFORE UPDATE ON ai_financial_sessions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
