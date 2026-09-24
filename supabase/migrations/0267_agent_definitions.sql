-- Issue #46 (parte da #19 — Orquestrador Global e agentes de IA
-- contextuais): entidade "Agent Definition" configurável, reutilizável por
-- múltiplos pontos de invocação (Agent Runtime Invocation) em vez de cada
-- módulo hardcodar persona/regras no código (ver actions/financial-ai.ts,
-- actions/forms-ai.ts, actions/automations-ai.ts hoje).
--
-- allowed_tools/allowed_skills são só uma RESTRIÇÃO adicional sobre o que o
-- agente pode tentar chamar — nunca uma concessão de acesso. A autorização
-- real continua em lib/agent/execute.ts::executeTool() (permissão de
-- membership + capability/entitlement da #31), avaliada com o contexto de
-- quem/o-quê disparou a execução (Runtime Context), nunca com base só na
-- definição. Ver lib/agent-definitions/invoke.ts.
CREATE TABLE IF NOT EXISTS agent_definitions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key                     text NOT NULL,                 -- slug estável (ex.: "sdr", "financeiro") — referenciado por Atribuições (#49)
  name                    text NOT NULL,
  role_label              text,                           -- "SDR", "Financeiro", "Suporte"...
  description             text,
  -- Como o agente se comporta (Personalidade) vs. pra quem ele fala (Persona) — separados por pedido explícito da issue #19.
  personality             text,
  persona                 text,
  tone                    text NOT NULL DEFAULT 'profissional',
  language                text NOT NULL DEFAULT 'pt-BR',
  objective               text,
  success_criteria        text,
  rules                   text,
  additional_instructions text,
  handoff_conditions      text,
  autonomy_limits         jsonb NOT NULL DEFAULT '{}',
  -- Agent Knowledge específico deste agente (texto livre por ora — a
  -- consolidação com uma Biblioteca compartilhada entre agentes é a #50).
  knowledge               text,
  -- Nomes de tool de lib/agent/tools/registry.ts que este agente pode
  -- tentar chamar. Enforcement real acontece em executeTool(), nunca aqui.
  allowed_tools           jsonb NOT NULL DEFAULT '[]',
  -- Placeholder — nenhum sistema de Skills existe ainda no projeto (ver
  -- auditoria da issue #19); guardado pra quando existir, sem enforcement.
  allowed_skills          jsonb NOT NULL DEFAULT '[]',
  model                   text NOT NULL DEFAULT 'claude-haiku-4-5',
  is_active               boolean NOT NULL DEFAULT true,
  created_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);
CREATE INDEX IF NOT EXISTS idx_agent_definitions_org ON agent_definitions(organization_id);

ALTER TABLE agent_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agent definitions access" ON agent_definitions;
CREATE POLICY "Agent definitions access" ON agent_definitions FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Agent definitions super admin" ON agent_definitions;
CREATE POLICY "Agent definitions super admin" ON agent_definitions FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE agent_definitions IS 'Issue #46: Agent Definition configurável (identidade/persona/regras/tools) reaproveitável por múltiplos pontos de invocação. Nunca concede acesso por si só — ver lib/agent-definitions/invoke.ts e lib/agent/execute.ts::executeTool().';
