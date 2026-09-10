-- Althos Voice — Fase 6: presença da equipe (Online/Ocupado/Não perturbe/Offline).
CREATE TABLE IF NOT EXISTS voice_agent_presence (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'offline', -- online | busy | dnd | offline
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE voice_agent_presence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voice agent presence access" ON voice_agent_presence;
CREATE POLICY "Voice agent presence access" ON voice_agent_presence FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Voice agent presence super admin" ON voice_agent_presence;
CREATE POLICY "Voice agent presence super admin" ON voice_agent_presence FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE voice_agent_presence IS 'Althos Voice: status de disponibilidade da equipe (usuário controla; sistema também atualiza durante uma ligação — Fase 6).';
