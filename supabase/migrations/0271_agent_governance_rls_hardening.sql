-- Achado P1 da revisão automática da PR #52: as policies "FOR ALL" de
-- agent_definitions/agent_assignments/library_items/agent_pending_approvals
-- (migrations 0267-0270) só checavam membership de org — qualquer membro,
-- mesmo sem a permissão 'settings' que as Server Actions exigem
-- (actions/agent-*.ts, actions/library.ts), podia escrever direto via
-- REST/Supabase client, contornando a checagem de permissão da aplicação.
--
-- has_settings_permission() replica exatamente lib/permissions.ts::canAccess()
-- pra 'settings' (owner sempre; admin sempre a menos que revogado
-- explicitamente; member só com permissions.settings=true explícito) — não
-- um substituto aproximado por role, pra não regredir o caso real de um
-- member com 'settings' concedido explicitamente. Leitura continua liberada
-- pra qualquer membro da org (baixa sensibilidade).
CREATE OR REPLACE FUNCTION has_settings_permission(org_id uuid)
RETURNS boolean AS $$
  SELECT CASE
    WHEN role = 'owner' THEN true
    WHEN role = 'admin' THEN COALESCE((permissions->>'settings')::boolean, true)
    ELSE COALESCE((permissions->>'settings')::boolean, false)
  END
  FROM memberships
  WHERE organization_id = org_id AND user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION has_settings_permission(uuid) IS 'Espelha lib/permissions.ts::canAccess(role, permissions, "settings") em SQL — usado pra restringir escrita nas tabelas de governança de agentes de IA (agent_definitions, agent_assignments, library_items, agent_pending_approvals) ao mesmo conjunto de usuários que as Server Actions já autorizam, fechando o bypass de escrever direto via REST/Supabase client.';

DO $$
DECLARE
  t text;
  old_policy text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agent_definitions', 'agent_assignments', 'library_items', 'agent_pending_approvals']
  LOOP
    old_policy := CASE t
      WHEN 'agent_definitions' THEN 'Agent definitions access'
      WHEN 'agent_assignments' THEN 'Agent assignments access'
      WHEN 'library_items' THEN 'Library items access'
      WHEN 'agent_pending_approvals' THEN 'Agent pending approvals access'
    END;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', old_policy, t);

    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (organization_id IN (SELECT get_user_organizations()))', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (has_settings_permission(organization_id))', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (has_settings_permission(organization_id)) WITH CHECK (has_settings_permission(organization_id))', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (has_settings_permission(organization_id))', t || '_delete', t);
  END LOOP;
END $$;

-- agent_pending_approvals é escrita pelo próprio Execution Engine via
-- admin client (createAdminClient(), bypassa RLS) quando enfileira uma
-- aprovação em nome de um usuário comum, e por resolvePendingApproval()
-- (também admin client) ao aprovar/rejeitar — as policies acima só
-- protegem contra escrita direta via client autenticado comum, não afetam
-- esses fluxos server-side.
