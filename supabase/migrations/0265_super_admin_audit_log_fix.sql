-- ============================================================================
-- 0264_super_admin_audit_log_fix.sql
-- Issue #33 — corrige um bug real e ativo encontrado na auditoria: desde
-- 0005_super_admin.sql, `super_admin_audit_log.action` só aceita
-- 'impersonate_start'/'impersonate_end' (CHECK) e `target_organization_id`
-- é NOT NULL — mas todo código de admin escrito depois (update_account_plan,
-- update_limits, grant_super_admin, module_flag, update_config, update_plan,
-- referral_*) tenta inserir outras ações, várias delas com
-- target_organization_id null (mudanças em nível de CONTA, não de org).
--
-- Confirmado ao vivo antes desta migration:
--   SELECT count(*) FROM super_admin_audit_log
--    WHERE action NOT IN ('impersonate_start','impersonate_end');
--   -- => 0
-- Ou seja: TODA tentativa de auditar essas ações falhou silenciosamente
-- (o INSERT violava a constraint, o erro nunca era checado pelo caller) —
-- há meses/anos de mudanças sensíveis de super-admin sem nenhum registro
-- de auditoria, apesar do código parecer estar logando. Esta migration
-- corrige o schema; lib/super-admin/audit.ts (novo) + os callers passam a
-- checar o erro do insert e falhar a ação se o log não gravar (auditoria
-- deixa de ser "melhor esforço").
--
-- Também adiciona as colunas que #33 pede explicitamente (ator/tenant/ação/
-- valor anterior/novo valor/origem/timestamp): old_value, new_value
-- (jsonb), reason (text), e target_account_id (mudanças em nível de conta
-- — ex.: troca de plano — não tinham onde ir além de null).
-- ============================================================================

ALTER TABLE super_admin_audit_log DROP CONSTRAINT IF EXISTS super_admin_audit_log_action_check;

ALTER TABLE super_admin_audit_log ALTER COLUMN target_organization_id DROP NOT NULL;

ALTER TABLE super_admin_audit_log ADD COLUMN IF NOT EXISTS target_account_id uuid REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE super_admin_audit_log ADD COLUMN IF NOT EXISTS old_value jsonb;
ALTER TABLE super_admin_audit_log ADD COLUMN IF NOT EXISTS new_value jsonb;
ALTER TABLE super_admin_audit_log ADD COLUMN IF NOT EXISTS reason text;

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_log_account ON super_admin_audit_log(target_account_id);

-- Ação continua obrigatória e não-vazia, mas sem a lista fechada de 2026-01
-- que já não refletia a realidade do produto.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'super_admin_audit_log_action_not_blank'
  ) THEN
    ALTER TABLE super_admin_audit_log
      ADD CONSTRAINT super_admin_audit_log_action_not_blank CHECK (length(trim(action)) > 0);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Reconciliação de histórico (mesmo padrão de 0262 pra accounts/
-- account_members): a migration tracked 0060_super_admin_panel.sql define
-- is_super_admin() lendo `user_metadata` (auto-editável pelo próprio usuário
-- via supabase.auth.updateUser({ data }) — um risco real de privilege
-- escalation via RLS, já sinalizado por comentário em
-- lib/supabase/types.ts::isSuperAdmin(), a checagem em nível de app, que
-- corretamente usa `app_metadata`). Checagem direta no banco de produção
-- (auditoria #33) mostrou que a função REAL já foi corrigida pra
-- `app_metadata` fora do fluxo de migrations — só o histórico rastreado
-- ficou desatualizado/inseguro. Este CREATE OR REPLACE só faz o git
-- refletir a versão segura real, pro próximo `supabase db reset` local não
-- regredir pra versão vulnerável de 0060.
--
-- IMPORTANTE — STABLE: 0140_audit_p0_rls_and_indexes.sql já tinha marcado
-- esta função como STABLE de propósito (é usada por dezenas de RLS
-- policies; sem STABLE o planner reavalia a cada linha em vez de cachear
-- por statement). A primeira versão deste CREATE OR REPLACE (aplicada
-- nesta mesma sessão) esqueceu o `STABLE` e resetou a função pro default
-- VOLATILE em produção — regressão de performance real, não só teórica
-- (achado da revisão automática da PR #38). Corrigido abaixo.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::BOOLEAN,
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin',
    FALSE
  );
END;
$function$;
