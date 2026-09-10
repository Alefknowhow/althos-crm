-- Althos Voice — Fase 3: agentes de Voice AI.
CREATE TABLE IF NOT EXISTS voice_ai_agents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  role_label       text,                    -- "SDR", "Cobrança", "Recepcionista"...
  objective        text,
  persona_prompt   text,
  tone             text NOT NULL DEFAULT 'consultivo',
  model            text NOT NULL DEFAULT 'claude-haiku-4-5',
  voice            text NOT NULL DEFAULT 'default',
  language         text NOT NULL DEFAULT 'pt-BR',
  -- Permissões explícitas de tools — enforcement no backend, nunca só no prompt.
  allowed_tools    jsonb NOT NULL DEFAULT '[]',
  transfer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voice_ai_agents_org ON voice_ai_agents(organization_id);

ALTER TABLE voice_ai_agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voice ai agents access" ON voice_ai_agents;
CREATE POLICY "Voice ai agents access" ON voice_ai_agents FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Voice ai agents super admin" ON voice_ai_agents;
CREATE POLICY "Voice ai agents super admin" ON voice_ai_agents FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE voice_ai_agents IS 'Althos Voice: agentes de Voice AI configuráveis por organização (Fase 3). allowed_tools é a lista de nomes de tool que o agente pode executar — a checagem real acontece no executor (lib/voice/ai-tools.ts), nunca só no prompt.';

ALTER TABLE voice_calls ADD CONSTRAINT voice_calls_ai_agent_id_fkey
  FOREIGN KEY (ai_agent_id) REFERENCES voice_ai_agents(id) ON DELETE SET NULL;
