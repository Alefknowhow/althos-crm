-- Issue #49 (parte da #19) — Atribuições: qual Agent Definition (#46) atua
-- em cada cenário padrão (ex.: "whatsapp.inbound" → SDR). Modelo
-- deliberadamente simples ("canal/cenário → Agent Definition"), sem editor
-- de automação — isso já existe em Automações e não é o alvo aqui.
CREATE TABLE IF NOT EXISTS agent_assignments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Texto livre, sem enum fechado (mesma decisão de agent_definitions.key)
  -- — convenção sugerida: "<canal>.<cenário>", ex.: "whatsapp.inbound",
  -- "instagram.inbound", "support.general", "billing".
  scenario_key          text NOT NULL,
  agent_definition_id   uuid NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  is_active             boolean NOT NULL DEFAULT true,
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, scenario_key)
);
CREATE INDEX IF NOT EXISTS idx_agent_assignments_org ON agent_assignments(organization_id);

ALTER TABLE agent_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agent assignments access" ON agent_assignments;
CREATE POLICY "Agent assignments access" ON agent_assignments FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Agent assignments super admin" ON agent_assignments;
CREATE POLICY "Agent assignments super admin" ON agent_assignments FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE agent_assignments IS 'Issue #49: qual Agent Definition (agent_definitions) atua em cada cenário padrão da org (ex.: whatsapp.inbound). Ausência de linha = comportamento legado do módulo (ex.: ai_attendant_config.persona_prompt no WhatsApp) — puramente aditivo, nunca obrigatório.';
