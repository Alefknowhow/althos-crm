-- Issue #51 (parte da #19) — Approval flow assíncrono. lib/agent/execute.ts
-- já previa tool.requiresApproval:true no contrato, mas bloqueava com
-- "ainda não suportado nesta fase". Nenhuma tool declara
-- requiresApproval:true hoje (auditado em lib/agent/tools/*.ts) — esta
-- infra fica pronta pra quando uma tool passar a exigir aprovação humana,
-- sem mudar comportamento de nenhuma tool existente.
CREATE TABLE IF NOT EXISTS agent_pending_approvals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Usuário/workflow que disparou a execução original (Runtime Context) —
  -- a aprovação reexecuta com O CONTEXTO DELE, revalidado na hora, nunca
  -- com o do revisor.
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_label       text NOT NULL,
  tool              text NOT NULL,
  input             jsonb,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  review_note       text,
  result            jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_pending_approvals_org_status ON agent_pending_approvals(organization_id, status);

ALTER TABLE agent_pending_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agent pending approvals access" ON agent_pending_approvals;
CREATE POLICY "Agent pending approvals access" ON agent_pending_approvals FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Agent pending approvals super admin" ON agent_pending_approvals;
CREATE POLICY "Agent pending approvals super admin" ON agent_pending_approvals FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE agent_pending_approvals IS 'Issue #51: fila de ações de agente que exigem aprovação humana (tool.requiresApproval=true). Aprovar reexecuta o handler original revalidando permissão/capability do usuário que disparou a execução na hora — aprovação nunca concede acesso por si só.';

-- Amplia o CHECK de agent_audit_log (migration 0191) pra cobrir o novo
-- status "pending_approval" (ação enfileirada, nem executada nem negada).
ALTER TABLE agent_audit_log DROP CONSTRAINT IF EXISTS agent_audit_log_status_check;
ALTER TABLE agent_audit_log ADD CONSTRAINT agent_audit_log_status_check CHECK (status IN ('success', 'error', 'denied', 'pending_approval'));
