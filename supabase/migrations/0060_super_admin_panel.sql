-- ============================================================================
-- 0060_super_admin_panel.sql
-- Painel Super Admin — apenas o que FALTA, estendendo o subsistema existente.
--
-- AUDITORIA DE SCHEMA (decisões de adaptação vs. a spec original):
--   * NÃO cria profiles.is_super_admin: a autorização já vive em
--     app_metadata.is_super_admin + função is_super_admin() (migration 0052,
--     endurecida contra user_metadata). Reaproveitamos isso.
--   * NÃO cria admin_audit_log nem admin_impersonation_sessions: já existem
--     super_admin_audit_log e impersonation por cookie (actions/super-admin.ts).
--   * Billing é por CONTA (accounts), não por organização. get_org_usage()
--     devolve uso da ORG + faz roll-up dos créditos de IA da CONTA dona.
--   * Materialized view criada SEM auto-refresh (refresh manual/posterior).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) SYSTEM_ALERTS — central de alertas operacionais do super admin
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_alerts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity                text NOT NULL DEFAULT 'info'
                            CHECK (severity IN ('info', 'warning', 'critical')),
  type                    text NOT NULL,            -- ex: 'churn_risk' | 'payment_failed' | 'usage_spike' | 'integration_down'
  title                   text NOT NULL,
  message                 text,
  status                  text NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'acknowledged', 'resolved')),
  target_organization_id  uuid REFERENCES organizations(id) ON DELETE SET NULL,
  target_account_id       uuid REFERENCES accounts(id) ON DELETE SET NULL,
  metadata                jsonb NOT NULL DEFAULT '{}',
  dedupe_key              text,                     -- evita alertas duplicados (UNIQUE quando 'open')
  created_at              timestamptz NOT NULL DEFAULT now(),
  acknowledged_at         timestamptz,
  resolved_at             timestamptz,
  resolved_by             uuid                       -- auth.users.id do super admin
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_status   ON system_alerts(status);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created  ON system_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_org      ON system_alerts(target_organization_id);
-- Um alerta "aberto" por dedupe_key (deduplicação de auto-alertas recorrentes).
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_alerts_open_dedupe
  ON system_alerts(dedupe_key) WHERE status = 'open' AND dedupe_key IS NOT NULL;

ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
-- Apenas super admins enxergam/gerenciam (service-role bypassa RLS de qualquer forma).
DROP POLICY IF EXISTS "super admin manage alerts" ON system_alerts;
CREATE POLICY "super admin manage alerts" ON system_alerts
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ----------------------------------------------------------------------------
-- 2) SYSTEM_CONFIG — configurações globais (key/value)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_config (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL DEFAULT '{}',
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super admin manage config" ON system_config;
CREATE POLICY "super admin manage config" ON system_config
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Defaults (idempotente).
INSERT INTO system_config (key, value, description) VALUES
  ('maintenance_mode',   '{"enabled": false, "message": ""}', 'Modo manutenção global do app'),
  ('signups_enabled',    '{"enabled": true}',                 'Permitir novos cadastros self-service'),
  ('alert_thresholds',   '{"churn_inactive_days": 14, "trial_ending_days": 3, "usage_spike_pct": 200}',
                          'Limiares usados pelos auto-alertas')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3) FUNÇÃO: get_org_usage(p_org_id) -> jsonb
--    Uso da ORGANIZAÇÃO + roll-up dos créditos de IA da CONTA dona.
--    SECURITY DEFINER: chamada via service-role nas server actions do admin.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_org_usage(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_org        organizations%ROWTYPE;
  v_period     text := to_char(now(), 'YYYY-MM');
  v_month_start timestamptz := date_trunc('month', now());
  v_leads_total   integer;
  v_leads_month   integer;
  v_members       integer;
  v_wa_out_month  integer;
  v_email_month   integer;
  v_tasks_open    integer;
  v_credits       jsonb;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF v_org.id IS NULL THEN
    RETURN jsonb_build_object('error', 'org_not_found');
  END IF;

  SELECT count(*) INTO v_leads_total FROM leads WHERE organization_id = p_org_id;
  SELECT count(*) INTO v_leads_month FROM leads
    WHERE organization_id = p_org_id AND created_at >= v_month_start;
  SELECT count(*) INTO v_members FROM memberships WHERE organization_id = p_org_id;
  SELECT count(*) INTO v_wa_out_month FROM whatsapp_messages
    WHERE organization_id = p_org_id AND direction = 'outbound' AND created_at >= v_month_start;
  SELECT count(*) INTO v_email_month FROM email_sends
    WHERE organization_id = p_org_id AND created_at >= v_month_start;
  SELECT count(*) INTO v_tasks_open FROM tasks
    WHERE organization_id = p_org_id AND status <> 'done';

  -- Créditos de IA são por CONTA (período corrente).
  SELECT jsonb_build_object(
           'included',  COALESCE(c.credits_included, 0),
           'purchased', COALESCE(c.credits_purchased, 0),
           'used',      COALESCE(c.credits_used, 0),
           'remaining', COALESCE(c.credits_included + c.credits_purchased - c.credits_used, 0),
           'period',    v_period
         )
    INTO v_credits
    FROM ai_credits c
   WHERE c.account_id = v_org.account_id AND c.period_month = v_period;

  RETURN jsonb_build_object(
    'org_id',       p_org_id,
    'account_id',   v_org.account_id,
    'plan',         v_org.plan,
    'status',       v_org.subscription_status,
    'period',       v_period,
    'usage', jsonb_build_object(
      'leads_total',     v_leads_total,
      'leads_month',     v_leads_month,
      'members',         v_members,
      'whatsapp_month',  v_wa_out_month,
      'email_month',     v_email_month,
      'tasks_open',      v_tasks_open
    ),
    'limits', jsonb_build_object(
      'leads',           v_org.limit_leads,
      'whatsapp_monthly',v_org.limit_whatsapp_monthly,
      'email_monthly',   v_org.limit_email_monthly,
      'users',           v_org.limit_users
    ),
    'ai_credits',   COALESCE(v_credits, jsonb_build_object(
      'included', 0, 'purchased', 0, 'used', 0, 'remaining', 0, 'period', v_period
    ))
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4) MATERIALIZED VIEW: admin_dashboard_metrics
--    Resumo executivo (1 linha). SEM auto-refresh — refresh manual:
--      REFRESH MATERIALIZED VIEW admin_dashboard_metrics;
--    MRR normalizado para base mensal (anual = price_annual_cents / 12).
-- ----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS admin_dashboard_metrics;
CREATE MATERIALIZED VIEW admin_dashboard_metrics AS
WITH active_subs AS (
  SELECT s.id, s.account_id, s.plan_id, s.billing_cycle,
         p.price_monthly_cents, p.price_annual_cents
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
   WHERE s.status IN ('active', 'trialing')
),
mrr AS (
  SELECT COALESCE(SUM(
           CASE WHEN billing_cycle = 'annual'
                THEN round(price_annual_cents / 12.0)
                ELSE price_monthly_cents END
         ), 0)::bigint AS mrr_cents
    FROM active_subs
   WHERE plan_id <> 'free'
)
SELECT
  (SELECT count(*) FROM accounts)                                              AS total_accounts,
  (SELECT count(*) FROM organizations)                                        AS total_orgs,
  (SELECT count(*) FROM organizations
     WHERE subscription_status = 'active')                                    AS active_orgs,
  (SELECT count(*) FROM organizations
     WHERE subscription_status = 'trialing')                                  AS trial_orgs,
  (SELECT count(DISTINCT user_id) FROM memberships)                           AS total_users,
  (SELECT count(*) FROM leads)                                                AS total_leads,
  (SELECT count(*) FROM active_subs WHERE plan_id <> 'free')                  AS paying_accounts,
  (SELECT mrr_cents FROM mrr)                                                 AS mrr_cents,
  (SELECT mrr_cents FROM mrr) * 12                                            AS arr_cents,
  (SELECT count(*) FROM organizations
     WHERE created_at >= now() - interval '7 days')                          AS signups_7d,
  (SELECT count(*) FROM organizations
     WHERE created_at >= now() - interval '30 days')                         AS signups_30d,
  (SELECT COALESCE(SUM(credits_used), 0) FROM ai_credits
     WHERE period_month = to_char(now(), 'YYYY-MM'))                          AS ai_credits_used_month,
  (SELECT count(*) FROM system_alerts
     WHERE status = 'open' AND severity = 'critical')                         AS open_critical_alerts,
  now()                                                                       AS computed_at;

-- Acesso só via service-role (server actions do admin). Tranca p/ anon/authenticated.
REVOKE ALL ON admin_dashboard_metrics FROM anon, authenticated;

-- Índice único exigido para permitir REFRESH ... CONCURRENTLY no futuro.
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_dashboard_metrics_singleton
  ON admin_dashboard_metrics ((1));

-- Helper RPC para REFRESH a partir das server actions do admin (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION refresh_admin_dashboard_metrics()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW admin_dashboard_metrics;
END;
$$;
REVOKE ALL ON FUNCTION refresh_admin_dashboard_metrics() FROM anon, authenticated;
