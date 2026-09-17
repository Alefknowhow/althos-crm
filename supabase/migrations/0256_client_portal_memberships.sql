-- Módulo Clientes (Tráfego) — Fase 3.3: Portal externo do cliente.
-- Reaproveita Supabase Auth (auth.users) pra autenticação do usuário
-- externo — nunca senha em texto plano, nunca infra própria. O que
-- diferencia um usuário do portal de um membro interno da agência é
-- simplesmente NÃO ter uma linha em `memberships`: getCurrentOrganization/
-- checkMemberPermission já falham naturalmente pra esse usuário, então ele
-- nunca acessa /app/... por acidente. client_portal_memberships é o único
-- vínculo (usuário ↔ cliente ↔ role), checado explicitamente por
-- requirePortalAccess (actions/client-portal.ts) em toda rota/action do
-- portal — nunca confiar em RLS sozinho aqui, porque as tabelas de dados
-- (sales, campaign_creatives, storage_objects, etc.) têm policy por
-- organização pensada pro membro interno, não pro usuário do portal.
CREATE TABLE IF NOT EXISTS client_portal_memberships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contato_id      UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'client_member' CHECK (role IN ('client_admin', 'client_member')),
    invited_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (contato_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_portal_memberships_org ON client_portal_memberships (organization_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_memberships_contato ON client_portal_memberships (contato_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_memberships_user ON client_portal_memberships (user_id);

ALTER TABLE client_portal_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal user reads own membership" ON client_portal_memberships
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Org manages portal memberships" ON client_portal_memberships
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Portal memberships super admin" ON client_portal_memberships
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE client_portal_memberships IS
  'Módulo Clientes (Tráfego) — vínculo usuário↔cliente↔role pro Portal Externo do Cliente. Autenticação via Supabase Auth (auth.users), sem senha própria. Verificação de acesso sempre explícita em requirePortalAccess, nunca só via RLS das tabelas de dados.';
