-- Etapa 3 — Althos Agent Layer (Milestone 1): autenticação de agente via
-- Personal Access Token + log de auditoria de tool calls.

CREATE TABLE IF NOT EXISTS agent_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    agent_label     TEXT NOT NULL DEFAULT 'outro' CHECK (agent_label IN ('claude_code', 'codex', 'outro')),
    token_hash      TEXT NOT NULL UNIQUE,
    token_prefix    TEXT NOT NULL, -- primeiros caracteres pra exibir na UI sem guardar o token puro
    last_used_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tokens_org ON agent_tokens (organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_hash ON agent_tokens (token_hash);

ALTER TABLE agent_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent tokens access" ON agent_tokens
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Agent tokens super admin" ON agent_tokens
  FOR ALL USING ((SELECT is_super_admin()));

CREATE TABLE IF NOT EXISTS agent_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    agent_label     TEXT NOT NULL,
    tool            TEXT NOT NULL,
    input           JSONB,
    status          TEXT NOT NULL CHECK (status IN ('success', 'error', 'denied')),
    error           TEXT,
    execution_ms    INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_org ON agent_audit_log (organization_id, created_at DESC);

ALTER TABLE agent_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent audit log access" ON agent_audit_log
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Agent audit log super admin" ON agent_audit_log
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE agent_tokens IS
  'Etapa 3 (Agent Layer) — Personal Access Tokens usados por agentes de IA (Claude Code, Codex) via MCP pra autenticar como um usuário do CRM. token_hash é sha256 do token; o valor puro nunca é persistido.';
COMMENT ON TABLE agent_audit_log IS
  'Etapa 3 (Agent Layer) — registro de toda tool call executada via MCP, uma linha por chamada.';
