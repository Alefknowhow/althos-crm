-- ============================================================================
-- 0057_billing_plans.sql
-- Sistema de planos, créditos de IA, indicações e cupons do Althos CRM.
--
-- ADAPTAÇÕES vs documento original (auditoria de schema real):
--   * ESCOPO POR CONTA: subscriptions / ai_credits / referrals referenciam
--     accounts(id), não organizations(id). O modelo real é conta -> N orgs.
--   * RLS usa account_members (não a tabela `memberships` direta).
--   * `subscriptions` é a fonte de verdade; faz backfill a partir do estado
--     atual de organizations (coluna `plan`, trial, period_end).
--   * NÃO cria organizations.plan_id (já existe organizations.plan legado).
--   * referral_code mora em accounts (não organizations).
--   * Reusa o trigger update_updated_at_column() já existente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) PRÉ-REQUISITO: garantir que toda organização tenha account_id.
--    Cria uma conta para cada org órfã e vincula o owner como admin.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r          record;
  v_account  uuid;
  v_owner    uuid;
BEGIN
  FOR r IN SELECT id, name, niche FROM organizations WHERE account_id IS NULL LOOP
    SELECT user_id INTO v_owner
      FROM memberships
     WHERE organization_id = r.id AND role = 'owner'
     LIMIT 1;

    INSERT INTO accounts (name, niche, owner_user_id)
    VALUES (r.name, r.niche, v_owner)
    RETURNING id INTO v_account;

    UPDATE organizations SET account_id = v_account WHERE id = r.id;

    IF v_owner IS NOT NULL THEN
      INSERT INTO account_members (account_id, user_id, role)
      VALUES (v_account, v_owner, 'admin')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 1) PLANS — catálogo global (não por conta)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
  id                  text PRIMARY KEY,            -- 'free' | 'starter' | 'pro' | 'business'
  name                text    NOT NULL,
  price_monthly_cents integer NOT NULL DEFAULT 0,
  price_annual_cents  integer NOT NULL DEFAULT 0,
  ai_credits_monthly  integer NOT NULL DEFAULT 0,
  max_leads_per_month integer NOT NULL DEFAULT 50, -- -1 = ilimitado
  max_users           integer NOT NULL DEFAULT 1,  -- -1 = ilimitado
  max_forms           integer NOT NULL DEFAULT 1,  -- -1 = ilimitado
  max_automations     integer NOT NULL DEFAULT 0,
  max_tenants         integer NOT NULL DEFAULT 1,  -- multi-tenant (orgs por conta)
  features            jsonb   NOT NULL DEFAULT '{}',
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

INSERT INTO plans (id, name, price_monthly_cents, price_annual_cents, ai_credits_monthly,
                   max_leads_per_month, max_users, max_forms, max_automations, max_tenants, features)
VALUES
('free', 'Free', 0, 0, 0, 50, 1, 1, 0, 1,
  '{"whatsapp":false,"instagram_automation":false,"meta_ads_panel":false,"capi_pixel":false,
    "lead_scoring":false,"ai_attendant":false,"ai_insights":false,"agendamentos":false,
    "catalogo":false,"export_reports":false,"white_label":false,"tasks":false,"multi_tenant":false}'),
('starter', 'Starter', 19700, 16700, 50, -1, 3, -1, 10, 1,
  '{"whatsapp":true,"instagram_automation":false,"meta_ads_panel":false,"capi_pixel":false,
    "lead_scoring":false,"ai_attendant":false,"ai_insights":false,"agendamentos":false,
    "catalogo":true,"export_reports":false,"white_label":false,"tasks":true,"multi_tenant":false}'),
('pro', 'Pro', 29700, 24800, 200, -1, 5, -1, -1, 1,
  '{"whatsapp":true,"instagram_automation":true,"meta_ads_panel":true,"capi_pixel":true,
    "lead_scoring":true,"ai_attendant":true,"ai_insights":false,"agendamentos":true,
    "catalogo":true,"export_reports":false,"white_label":false,"tasks":true,"multi_tenant":false}'),
('business', 'Business', 39700, 32700, 600, -1, -1, -1, -1, 5,
  '{"whatsapp":true,"instagram_automation":true,"meta_ads_panel":true,"capi_pixel":true,
    "lead_scoring":true,"ai_attendant":true,"ai_insights":true,"agendamentos":true,
    "catalogo":true,"export_reports":true,"white_label":true,"tasks":true,"multi_tenant":true}')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans are readable by authenticated" ON plans;
CREATE POLICY "plans are readable by authenticated"
  ON plans FOR SELECT USING (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 2) SUBSCRIPTIONS — uma assinatura por CONTA (fonte de verdade)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id             uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plan_id                text NOT NULL REFERENCES plans(id),
  status                 text NOT NULL DEFAULT 'active',   -- active | canceled | past_due | trialing
  billing_cycle          text NOT NULL DEFAULT 'monthly',  -- monthly | annual
  current_period_start   timestamptz NOT NULL DEFAULT now(),
  current_period_end     timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  canceled_at            timestamptz,
  trial_ends_at          timestamptz,
  payment_provider       text,                              -- 'asaas' | 'stripe' | 'manual'
  external_subscription_id text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  UNIQUE(account_id)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_account ON subscriptions(account_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account members can view own subscription" ON subscriptions;
CREATE POLICY "account members can view own subscription"
  ON subscriptions FOR SELECT
  USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Backfill: cria 1 assinatura por conta, mapeando o plano legado das orgs.
-- Mapa: starter -> starter; qualquer outro (trial/free_trial/null) -> free.
INSERT INTO subscriptions (account_id, plan_id, status, billing_cycle,
                           current_period_start, current_period_end, trial_ends_at, payment_provider)
SELECT
  a.id,
  CASE WHEN bool_or(o.plan = 'starter') THEN 'starter' ELSE 'free' END,
  CASE WHEN bool_or(o.subscription_status = 'trialing') THEN 'trialing' ELSE 'active' END,
  'monthly',
  now(),
  COALESCE(max(o.current_period_end), now() + interval '30 days'),
  max(o.trial_ends_at),
  'manual'
FROM accounts a
LEFT JOIN organizations o ON o.account_id = a.id
GROUP BY a.id
ON CONFLICT (account_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3) AI_CREDITS — saldo por CONTA, por mês
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_credits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  period_month      text NOT NULL,                  -- '2026-06'
  credits_included  integer NOT NULL DEFAULT 0,
  credits_purchased integer NOT NULL DEFAULT 0,
  credits_used      integer NOT NULL DEFAULT 0,
  reset_at          timestamptz NOT NULL,
  created_at        timestamptz DEFAULT now(),
  UNIQUE(account_id, period_month)
);
CREATE INDEX IF NOT EXISTS idx_ai_credits_account_period ON ai_credits(account_id, period_month);

ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account members can view own credits" ON ai_credits;
CREATE POLICY "account members can view own credits"
  ON ai_credits FOR SELECT
  USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 4) AI_CREDIT_TRANSACTIONS — log de consumo por CONTA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_credit_transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ai_credits_id  uuid REFERENCES ai_credits(id),
  type           text NOT NULL,   -- consumed | purchased | refunded | plan_reset
  action         text NOT NULL,   -- whatsapp_ai_reply | lead_scoring | instagram_ai_reply | ai_insights | report_generation
  credits_delta  integer NOT NULL,
  lead_id        uuid,
  metadata       jsonb DEFAULT '{}',
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_transactions_account ON ai_credit_transactions(account_id);

ALTER TABLE ai_credit_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account members can view own transactions" ON ai_credit_transactions;
CREATE POLICY "account members can view own transactions"
  ON ai_credit_transactions FOR SELECT
  USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 5) REFERRALS — indicações por CONTA
-- ----------------------------------------------------------------------------
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

CREATE TABLE IF NOT EXISTS referrals (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  referral_code          text NOT NULL,
  referred_account_id    uuid REFERENCES accounts(id),
  status                 text NOT NULL DEFAULT 'pending',     -- pending | converted | rewarded
  reward_type            text DEFAULT 'free_month',           -- free_month | discount | commission
  reward_value           integer DEFAULT 1,
  converted_at           timestamptz,
  rewarded_at            timestamptz,
  created_at             timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_account_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account members can view own referrals" ON referrals;
CREATE POLICY "account members can view own referrals"
  ON referrals FOR SELECT
  USING (referrer_account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));

-- Gera referral_code para contas novas (e backfill abaixo).
CREATE OR REPLACE FUNCTION generate_account_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.referral_code := upper(substring(md5(random()::text) FROM 1 FOR 8));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_account_referral_code ON accounts;
CREATE TRIGGER trg_account_referral_code
  BEFORE INSERT ON accounts
  FOR EACH ROW WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION generate_account_referral_code();

-- Backfill de referral_code para contas existentes.
UPDATE accounts
   SET referral_code = upper(substring(md5(random()::text || id::text) FROM 1 FOR 8))
 WHERE referral_code IS NULL;

-- ----------------------------------------------------------------------------
-- 6) COUPONS — cupons globais + log de uso por conta
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  description     text,
  discount_type   text NOT NULL,                 -- percent | fixed_cents
  discount_value  integer NOT NULL,
  applies_to_plan text REFERENCES plans(id),     -- null = todos
  max_uses        integer DEFAULT -1,            -- -1 = ilimitado
  uses_count      integer DEFAULT 0,
  duration_months integer DEFAULT 1,
  expires_at      timestamptz,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

INSERT INTO coupons (code, description, discount_type, discount_value, max_uses, duration_months, expires_at)
VALUES
  ('ALTHOS30',    'Lançamento — 30% off por 3 meses',          'percent', 30, 100, 3, now() + interval '90 days'),
  ('INDICACAO15', 'Cupom de indicado — 15% off no 1º mês',     'percent', 15, -1, 1, null)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coupons readable by authenticated" ON coupons;
CREATE POLICY "coupons readable by authenticated"
  ON coupons FOR SELECT USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS coupon_uses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id    uuid NOT NULL REFERENCES coupons(id),
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  applied_at   timestamptz DEFAULT now(),
  UNIQUE(coupon_id, account_id)
);
ALTER TABLE coupon_uses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account members can view own coupon uses" ON coupon_uses;
CREATE POLICY "account members can view own coupon uses"
  ON coupon_uses FOR SELECT
  USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 7) FUNÇÃO: account_has_feature(account_id, feature) -> boolean
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION account_has_feature(p_account_id uuid, p_feature text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_features jsonb;
BEGIN
  SELECT p.features INTO v_features
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
   WHERE s.account_id = p_account_id
     AND s.status IN ('active', 'trialing')
   ORDER BY s.created_at DESC
   LIMIT 1;

  RETURN COALESCE((v_features->>p_feature)::boolean, false);
END;
$$;

-- ----------------------------------------------------------------------------
-- 8) FUNÇÃO: consume_ai_credits(account_id, action, credits, lead_id, metadata)
--    Cria/garante o registro do período, valida saldo e debita atomicamente.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consume_ai_credits(
  p_account_id uuid,
  p_action     text,
  p_credits    integer,
  p_lead_id    uuid DEFAULT NULL,
  p_metadata   jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_period     text := to_char(now(), 'YYYY-MM');
  v_credit_row ai_credits%ROWTYPE;
  v_available  integer;
BEGIN
  INSERT INTO ai_credits (account_id, period_month, credits_included, reset_at)
  SELECT
    p_account_id,
    v_period,
    COALESCE((SELECT pl.ai_credits_monthly
                FROM plans pl
                JOIN subscriptions s ON s.plan_id = pl.id
               WHERE s.account_id = p_account_id
                 AND s.status IN ('active','trialing')
               LIMIT 1), 0),
    date_trunc('month', now()) + interval '1 month'
  ON CONFLICT (account_id, period_month) DO NOTHING;

  SELECT * INTO v_credit_row FROM ai_credits
   WHERE account_id = p_account_id AND period_month = v_period
   FOR UPDATE;

  v_available := v_credit_row.credits_included + v_credit_row.credits_purchased - v_credit_row.credits_used;

  IF v_available < p_credits THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'available', v_available);
  END IF;

  UPDATE ai_credits
     SET credits_used = credits_used + p_credits
   WHERE id = v_credit_row.id;

  INSERT INTO ai_credit_transactions
    (account_id, ai_credits_id, type, action, credits_delta, lead_id, metadata)
  VALUES
    (p_account_id, v_credit_row.id, 'consumed', p_action, -p_credits, p_lead_id, p_metadata);

  RETURN jsonb_build_object('success', true, 'credits_used', p_credits, 'remaining', v_available - p_credits);
END;
$$;
