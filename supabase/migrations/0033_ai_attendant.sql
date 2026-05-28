-- Bloco IA Atendente
-- Adds per-org config for the conversational AI agent, a knowledge base
-- (FAQ entries injected in the system prompt) and a sandbox for testing the
-- persona before connecting WhatsApp Cloud API.

CREATE TABLE IF NOT EXISTS ai_attendant_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    -- Persona prompt — the agency-specific tone/voice/rules.
    persona_prompt TEXT,
    business_context TEXT,

    -- Conversation goals (what AI should drive towards). The default is
    -- "qualificar e agendar" but agencies can override.
    primary_goal TEXT DEFAULT 'qualificar_agendar',

    -- Operating hours per weekday (0=sunday..6=saturday). NULL = disabled day.
    working_hours JSONB NOT NULL DEFAULT '{"1":[9,18],"2":[9,18],"3":[9,18],"4":[9,18],"5":[9,18]}'::jsonb,
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    out_of_hours_message TEXT,

    -- Escalation triggers — substrings that, if matched in user message, force
    -- handoff to a human. Per-org because terminology varies by vertical.
    handoff_phrases JSONB NOT NULL DEFAULT '["humano","atendente","responsavel","pessoa real","reclamacao","cancelar","advogado"]'::jsonb,

    -- Safety: hard limit on AI replies per conversation to avoid loops/spam.
    max_replies_per_conversation INTEGER NOT NULL DEFAULT 30,

    -- LLM choice — defaults to Haiku for cost; SaaS plans can upgrade per org.
    model TEXT NOT NULL DEFAULT 'claude-haiku-4-5',

    -- For first outbound message (new lead). Must be approved Meta HSM
    -- template name. Until WhatsApp Cloud is connected this stays unused.
    outbound_template_name TEXT,
    outbound_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_attendant_config_org
  ON ai_attendant_config (organization_id);

-- FAQ entries: the "brain" of the attendant. Each entry is a Q&A pair (plus
-- optional category) that the engine prepends to the system prompt so the AI
-- has access to org-specific facts (prices, procedures, hours, etc).
CREATE TABLE IF NOT EXISTS ai_knowledge_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category TEXT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_items_org_active
  ON ai_knowledge_items (organization_id, is_active);

-- Sandbox sessions: throwaway conversations operators use to test the persona
-- before going live. Distinct from whatsapp_conversations so playground noise
-- never pollutes real client data.
CREATE TABLE IF NOT EXISTS ai_sandbox_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    title TEXT,
    -- Simulated lead profile for the playground so AI sees "name", "phone", etc.
    simulated_lead JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_sandbox_sessions_org_user
  ON ai_sandbox_sessions (organization_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_sandbox_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES ai_sandbox_sessions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content TEXT NOT NULL,
    -- Cost tracking so operator sees token consumption while testing.
    tokens_input INTEGER,
    tokens_output INTEGER,
    cache_read_tokens INTEGER,
    cost_cents INTEGER,
    model TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_sandbox_messages_session_created
  ON ai_sandbox_messages (session_id, created_at);

-- RLS
ALTER TABLE ai_attendant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sandbox_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sandbox_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AI attendant config access" ON ai_attendant_config;
CREATE POLICY "AI attendant config access" ON ai_attendant_config FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "AI knowledge items access" ON ai_knowledge_items;
CREATE POLICY "AI knowledge items access" ON ai_knowledge_items FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "AI sandbox sessions access" ON ai_sandbox_sessions;
CREATE POLICY "AI sandbox sessions access" ON ai_sandbox_sessions FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "AI sandbox messages access" ON ai_sandbox_messages;
CREATE POLICY "AI sandbox messages access" ON ai_sandbox_messages FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

-- updated_at triggers
DROP TRIGGER IF EXISTS update_ai_attendant_config_updated_at ON ai_attendant_config;
CREATE TRIGGER update_ai_attendant_config_updated_at
  BEFORE UPDATE ON ai_attendant_config
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_knowledge_items_updated_at ON ai_knowledge_items;
CREATE TRIGGER update_ai_knowledge_items_updated_at
  BEFORE UPDATE ON ai_knowledge_items
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_sandbox_sessions_updated_at ON ai_sandbox_sessions;
CREATE TRIGGER update_ai_sandbox_sessions_updated_at
  BEFORE UPDATE ON ai_sandbox_sessions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
