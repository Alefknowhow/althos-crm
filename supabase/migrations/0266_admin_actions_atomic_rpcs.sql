-- ============================================================================
-- 0266_admin_actions_atomic_rpcs.sql
-- Corrige achados da revisão automática (Codex) na PR #38.
--
-- P1: updateAccountPlan/setModuleEnabled/grantVerticalToAccount/
-- revokeVerticalFromAccount faziam a mutação de negócio e o insert de
-- auditoria como chamadas separadas via PostgREST — cada uma é sua própria
-- transação implícita. Se o insert de auditoria falhasse, a mutação já
-- tinha sido commitada (subscriptions/organizations/ai_credits/
-- account_verticals/system_config), mas a action devolvia ok:false —
-- reportando falha pro admin enquanto a mudança sensível já tinha
-- acontecido, sem registro. A única forma real de atomicidade entre
-- múltiplas tabelas via PostgREST é uma função — as 4 RPCs abaixo fazem a
-- mutação inteira + o insert de auditoria na MESMA transação; se o insert
-- falhar (ou qualquer outro passo), tudo é revertido.
--
-- Chamadas exclusivamente via createAdminClient() (service role) — nunca
-- expostas a anon/authenticated (REVOKE explícito abaixo). A checagem
-- isSuperAdmin() continua em TypeScript, antes de qualquer chamada.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_account_plan(
  p_account_id uuid,
  p_plan_id text,
  p_status text,
  p_billing_cycle text,
  p_limit_leads int,
  p_limit_users int,
  p_limit_whatsapp int,
  p_limit_email int,
  p_actor_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ai_credits int;
  v_period     text;
  v_old_sub    jsonb;
  v_old_limits jsonb;
  v_new_value  jsonb;
BEGIN
  SELECT ai_credits_monthly INTO v_ai_credits FROM plans WHERE id = p_plan_id;
  v_ai_credits := COALESCE(v_ai_credits, 0);
  v_period := to_char(now(), 'YYYY-MM');

  SELECT jsonb_build_object('plan_id', plan_id, 'status', status, 'billing_cycle', billing_cycle)
    INTO v_old_sub FROM subscriptions WHERE account_id = p_account_id;

  SELECT jsonb_build_object(
    'limit_leads', limit_leads, 'limit_users', limit_users,
    'limit_whatsapp_monthly', limit_whatsapp_monthly, 'limit_email_monthly', limit_email_monthly
  ) INTO v_old_limits
  FROM organizations WHERE account_id = p_account_id LIMIT 1;

  INSERT INTO subscriptions (account_id, plan_id, status, billing_cycle)
  VALUES (p_account_id, p_plan_id, p_status, p_billing_cycle)
  ON CONFLICT (account_id) DO UPDATE SET
    plan_id = excluded.plan_id, status = excluded.status, billing_cycle = excluded.billing_cycle;

  UPDATE organizations SET
    plan                   = p_plan_id,
    subscription_status    = p_status,
    limit_leads            = p_limit_leads,
    limit_users            = p_limit_users,
    limit_whatsapp_monthly = p_limit_whatsapp,
    limit_email_monthly    = p_limit_email
  WHERE account_id = p_account_id;

  INSERT INTO ai_credits (account_id, period_month, credits_included, credits_purchased, credits_used)
  VALUES (p_account_id, v_period, v_ai_credits, 0, 0)
  ON CONFLICT (account_id, period_month) DO UPDATE SET credits_included = excluded.credits_included;

  v_new_value := jsonb_build_object(
    'plan_id', p_plan_id, 'status', p_status, 'billing_cycle', p_billing_cycle,
    'limit_leads', p_limit_leads, 'limit_users', p_limit_users,
    'limit_whatsapp_monthly', p_limit_whatsapp, 'limit_email_monthly', p_limit_email,
    'ai_credits_monthly', v_ai_credits
  );

  INSERT INTO super_admin_audit_log (super_admin_user_id, action, target_account_id, old_value, new_value, reason)
  VALUES (
    p_actor_id, 'update_account_plan', p_account_id,
    COALESCE(v_old_sub, '{}'::jsonb) || COALESCE(v_old_limits, '{}'::jsonb),
    v_new_value,
    p_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_module_flag(
  p_niche text,
  p_module_key text,
  p_enabled boolean,
  p_actor_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current      jsonb;
  v_list         jsonb;
  v_was_enabled  boolean;
  v_next         jsonb;
BEGIN
  SELECT value INTO v_current FROM system_config WHERE key = 'disabled_modules';
  v_current := COALESCE(v_current, '{}'::jsonb);
  v_list := COALESCE(v_current -> p_niche, '[]'::jsonb);
  -- Valor anterior real (não o inverso lógico do pedido) — achado #8 da
  -- revisão: uma chamada repetida/idempotente ou uma corrida entre dois
  -- admins não deve registrar uma transição que não aconteceu.
  v_was_enabled := NOT (v_list ? p_module_key);

  IF p_enabled THEN
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_list
      FROM jsonb_array_elements_text(v_list) x WHERE x <> p_module_key;
  ELSIF NOT (v_list ? p_module_key) THEN
    v_list := v_list || to_jsonb(p_module_key);
  END IF;

  v_next := jsonb_set(v_current, ARRAY[p_niche], v_list, true);

  UPDATE system_config SET value = v_next, updated_at = now(), updated_by = p_actor_id
  WHERE key = 'disabled_modules';

  INSERT INTO super_admin_audit_log (super_admin_user_id, action, old_value, new_value, reason)
  VALUES (
    p_actor_id, 'module_flag_toggle',
    jsonb_build_object('niche', p_niche, 'moduleKey', p_module_key, 'enabled', v_was_enabled),
    jsonb_build_object('niche', p_niche, 'moduleKey', p_module_key, 'enabled', p_enabled),
    p_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_account_vertical(
  p_account_id uuid,
  p_vertical text,
  p_granted_by uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old jsonb;
BEGIN
  SELECT jsonb_build_object('vertical', vertical, 'status', status) INTO v_old
  FROM account_verticals WHERE account_id = p_account_id AND vertical = p_vertical;

  INSERT INTO account_verticals (account_id, vertical, status, granted_by, granted_reason, activated_at, canceled_at)
  VALUES (p_account_id, p_vertical, 'active', p_granted_by, p_reason, now(), NULL)
  ON CONFLICT (account_id, vertical) DO UPDATE SET
    status = 'active', granted_by = excluded.granted_by, granted_reason = excluded.granted_reason,
    activated_at = now(), canceled_at = NULL, updated_at = now();

  INSERT INTO super_admin_audit_log (super_admin_user_id, action, target_account_id, old_value, new_value, reason)
  VALUES (
    p_granted_by, 'grant_account_vertical', p_account_id,
    v_old, jsonb_build_object('vertical', p_vertical, 'status', 'active'), p_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_account_vertical(
  p_account_id uuid,
  p_vertical text,
  p_actor_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old jsonb;
BEGIN
  SELECT jsonb_build_object('vertical', vertical, 'status', status) INTO v_old
  FROM account_verticals WHERE account_id = p_account_id AND vertical = p_vertical;

  UPDATE account_verticals SET status = 'pending_cancellation', canceled_at = now()
  WHERE account_id = p_account_id AND vertical = p_vertical;

  INSERT INTO super_admin_audit_log (super_admin_user_id, action, target_account_id, old_value, new_value, reason)
  VALUES (
    p_actor_id, 'revoke_account_vertical', p_account_id,
    v_old, jsonb_build_object('vertical', p_vertical, 'status', 'pending_cancellation'), p_reason
  );
END;
$$;

-- Só service_role (chamado exclusivamente via createAdminClient()) — estas
-- funções não fazem checagem própria de super-admin (dependem de
-- isSuperAdmin() já ter sido checado em TypeScript antes da chamada), então
-- NUNCA podem ficar expostas a anon/authenticated via PostgREST.
REVOKE ALL ON FUNCTION public.admin_update_account_plan(uuid, text, text, text, int, int, int, int, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_module_flag(text, text, boolean, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_grant_account_vertical(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_revoke_account_vertical(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
