-- Althos Voice — Fase 1 (Core): telefonia/SMS/Voice AI provider-agnostic.
--
-- Isolamento: infraestrutura (números, chamadas, credenciais do provider) é
-- por ORGANIZAÇÃO (organization_id) — mesmo padrão multi-tenant do resto do
-- CRM. Billing (créditos/ledger) é por CONTA (account_id), espelhando
-- ai_credits/ai_credit_transactions (0057_billing_plans.sql) — mas em
-- tabelas separadas: Voice Credits nunca se mistura com créditos de IA.

-- ----------------------------------------------------------------------------
-- 1) VOICE_ACCOUNTS — 1 por organização: mapeia pra uma subconta do provider
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_accounts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  provider                text NOT NULL DEFAULT 'twilio',
  provider_account_sid    text,
  provider_subaccount_sid text,
  status                  text NOT NULL DEFAULT 'pending',   -- pending | active | suspended
  recording_policy        text NOT NULL DEFAULT 'off',       -- off | always | team | ai_only
  -- Limites de segurança (centavos/quantidade). null = sem limite.
  limits                  jsonb NOT NULL DEFAULT '{}',        -- {daily_cents, monthly_cents, per_call_cents, automation_max_cents}
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voice_accounts_org ON voice_accounts(organization_id);

ALTER TABLE voice_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voice accounts access" ON voice_accounts;
CREATE POLICY "Voice accounts access" ON voice_accounts FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Voice accounts super admin" ON voice_accounts;
CREATE POLICY "Voice accounts super admin" ON voice_accounts FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE voice_accounts IS 'Althos Voice: 1 registro por organização, mapeando pra uma subconta do provider de telefonia (Twilio na V1). Nunca guarda credenciais — ver voice_provider_credentials.';

-- ----------------------------------------------------------------------------
-- 2) VOICE_PROVIDER_CREDENTIALS — segredo da subconta. SEM policy de SELECT
--    pro client: RLS habilitada e ZERO policies = só service role (admin
--    client) consegue ler. Nunca expor no frontend.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_provider_credentials (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_account_id uuid NOT NULL UNIQUE REFERENCES voice_accounts(id) ON DELETE CASCADE,
  auth_token       text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE voice_provider_credentials ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy CREATE — negação por padrão pra qualquer client autenticado.

COMMENT ON TABLE voice_provider_credentials IS 'Auth token da subconta do provider (Twilio). RLS habilitada sem nenhuma policy — só createAdminClient() (service role) lê. Nunca deve chegar ao browser.';

-- ----------------------------------------------------------------------------
-- 3) VOICE_NUMBERS — números comprados por organização
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_numbers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider            text NOT NULL DEFAULT 'twilio',
  provider_number_sid text,
  e164_number         text NOT NULL,
  capabilities        jsonb NOT NULL DEFAULT '{"voice": true, "sms": false}',
  assigned_user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'active',   -- active | released
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voice_numbers_org ON voice_numbers(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_numbers_e164 ON voice_numbers(e164_number) WHERE status = 'active';

ALTER TABLE voice_numbers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voice numbers access" ON voice_numbers;
CREATE POLICY "Voice numbers access" ON voice_numbers FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Voice numbers super admin" ON voice_numbers;
CREATE POLICY "Voice numbers super admin" ON voice_numbers FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE voice_numbers IS 'Althos Voice: números de telefone comprados/atribuídos por organização.';

-- ----------------------------------------------------------------------------
-- 4) VOICE_CALLS — histórico de chamadas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_calls (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contato_id         uuid REFERENCES contatos(id) ON DELETE SET NULL,
  direction          text NOT NULL,                     -- inbound | outbound
  human_or_ai        text NOT NULL DEFAULT 'human',      -- human | ai (Voice AI só na Fase 3)
  user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_agent_id        uuid,                               -- FK futura pra voice_ai_agents (Fase 3)
  from_number        text NOT NULL,
  to_number          text NOT NULL,
  provider           text NOT NULL DEFAULT 'twilio',
  provider_call_id   text,
  status             text NOT NULL DEFAULT 'queued',     -- queued | ringing | in_progress | completed | failed | no_answer | canceled
  started_at         timestamptz,
  answered_at        timestamptz,
  ended_at           timestamptz,
  duration_seconds   integer,
  outcome            text,                               -- ver Call Outcome (Fase 5) — livre por enquanto
  recording_id       uuid,                                -- FK futura pra voice_recordings (evita dependência circular na criação)
  provider_cost_cents integer NOT NULL DEFAULT 0,
  althos_cost_cents   integer NOT NULL DEFAULT 0,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voice_calls_org ON voice_calls(organization_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_contato ON voice_calls(contato_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_provider_call_id ON voice_calls(provider_call_id);

ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voice calls access" ON voice_calls;
CREATE POLICY "Voice calls access" ON voice_calls FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Voice calls super admin" ON voice_calls;
CREATE POLICY "Voice calls super admin" ON voice_calls FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE voice_calls IS 'Althos Voice: histórico completo de chamadas (humanas e, futuramente, Voice AI), vinculadas a contato/responsável quando aplicável.';

-- ----------------------------------------------------------------------------
-- 5) VOICE_RECORDINGS — gravações associadas a uma chamada
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_recordings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  voice_call_id          uuid NOT NULL REFERENCES voice_calls(id) ON DELETE CASCADE,
  provider_recording_sid text,
  url                    text,
  duration_seconds       integer,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_org ON voice_recordings(organization_id);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_call ON voice_recordings(voice_call_id);

ALTER TABLE voice_recordings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voice recordings access" ON voice_recordings;
CREATE POLICY "Voice recordings access" ON voice_recordings FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Voice recordings super admin" ON voice_recordings;
CREATE POLICY "Voice recordings super admin" ON voice_recordings FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE voice_recordings IS 'Althos Voice: gravações de chamadas. Política de gravação (off/always/team/ai_only) fica em voice_accounts.recording_policy.';

ALTER TABLE voice_calls ADD CONSTRAINT voice_calls_recording_id_fkey
  FOREIGN KEY (recording_id) REFERENCES voice_recordings(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 6) VOICE_PROVIDER_EVENTS — log de webhooks recebidos, com idempotência
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_provider_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid REFERENCES organizations(id) ON DELETE CASCADE,
  provider           text NOT NULL DEFAULT 'twilio',
  event_type         text NOT NULL,
  provider_event_id  text NOT NULL,
  payload            jsonb NOT NULL DEFAULT '{}',
  processed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS idx_voice_provider_events_org ON voice_provider_events(organization_id);

ALTER TABLE voice_provider_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voice provider events super admin only" ON voice_provider_events;
CREATE POLICY "Voice provider events super admin only" ON voice_provider_events FOR ALL USING ((SELECT is_super_admin()));
-- Sem policy de acesso por organização — só o webhook (service role) e o
-- super-admin (auditoria) precisam ler esta tabela; não é exposta ao usuário.

COMMENT ON TABLE voice_provider_events IS 'Log de eventos de webhook do provider de telefonia, com UNIQUE(provider, provider_event_id) garantindo idempotência de processamento.';

-- ----------------------------------------------------------------------------
-- 7) VOICE_CREDITS + VOICE_CREDIT_TRANSACTIONS — ledger de billing, por CONTA
--    (mesmo padrão de ai_credits/ai_credit_transactions, tabelas SEPARADAS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_credits (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  period_month             text NOT NULL,                 -- '2026-06' — só pra agregação de "consumo este mês"
  credits_included_cents   integer NOT NULL DEFAULT 0,     -- sempre 0 na V1: planos não incluem Voice Credits
  credits_purchased_cents  integer NOT NULL DEFAULT 0,
  credits_used_cents       integer NOT NULL DEFAULT 0,
  reset_at                 timestamptz NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, period_month)
);
CREATE INDEX IF NOT EXISTS idx_voice_credits_account_period ON voice_credits(account_id, period_month);

ALTER TABLE voice_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can view own voice credits" ON voice_credits;
CREATE POLICY "Account members can view own voice credits" ON voice_credits FOR SELECT
  USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Voice credits super admin" ON voice_credits;
CREATE POLICY "Voice credits super admin" ON voice_credits FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE voice_credits IS 'Saldo do Althos Voice Credits por CONTA/mês, em centavos. Separado por completo de ai_credits — nunca compartilha saldo com créditos de IA.';

CREATE TABLE IF NOT EXISTS voice_credit_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  voice_credits_id    uuid REFERENCES voice_credits(id),
  type                text NOT NULL,          -- purchased | consumed | refunded
  usage_type          text,                   -- call_human | call_ai | sms | number_rental (null p/ purchased)
  voice_call_id       uuid REFERENCES voice_calls(id) ON DELETE SET NULL,
  quantity            numeric,                -- ex.: minutos/segmentos, informativo
  provider_cost_cents integer NOT NULL DEFAULT 0,
  althos_cost_cents   integer NOT NULL DEFAULT 0,   -- delta real no saldo (negativo em consumo)
  balance_after_cents integer NOT NULL,
  metadata            jsonb DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voice_credit_tx_account ON voice_credit_transactions(account_id);

ALTER TABLE voice_credit_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can view own voice transactions" ON voice_credit_transactions;
CREATE POLICY "Account members can view own voice transactions" ON voice_credit_transactions FOR SELECT
  USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Voice credit transactions super admin" ON voice_credit_transactions;
CREATE POLICY "Voice credit transactions super admin" ON voice_credit_transactions FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE voice_credit_transactions IS 'Ledger imutável de débitos/créditos do Althos Voice Credits — cada linha é um evento; nunca só um UPDATE de saldo.';

-- ----------------------------------------------------------------------------
-- 8) VOICE_PRICING_CONFIG — markup centralizado (1 linha global)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_pricing_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  markup_pct  numeric NOT NULL DEFAULT 30,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO voice_pricing_config (markup_pct)
SELECT 30 WHERE NOT EXISTS (SELECT 1 FROM voice_pricing_config);

ALTER TABLE voice_pricing_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voice pricing config super admin only" ON voice_pricing_config;
CREATE POLICY "Voice pricing config super admin only" ON voice_pricing_config FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE voice_pricing_config IS 'Markup padrão (%) aplicado sobre o custo do provider pra chegar no preço Althos. 1 linha global, editável só por super-admin. Nunca hardcodear markup em componentes/actions.';

-- ----------------------------------------------------------------------------
-- 9) FUNÇÃO: consume_voice_credits(account_id, usage_type, provider_cost_cents, ...)
--    Mesma trava atômica de consume_ai_credits, mas em centavos e checando
--    também os limites de segurança da organização (voice_accounts.limits).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consume_voice_credits(
  p_account_id          uuid,
  p_organization_id     uuid,
  p_usage_type          text,
  p_provider_cost_cents integer,
  p_markup_pct          numeric DEFAULT 30,
  p_voice_call_id       uuid DEFAULT NULL,
  p_metadata            jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_period       text := to_char(now(), 'YYYY-MM');
  v_credit_row   voice_credits%ROWTYPE;
  v_available    integer;
  v_althos_cost  integer := ceil(p_provider_cost_cents * (1 + p_markup_pct / 100.0));
  v_limits       jsonb;
  v_spent_today  integer;
  v_spent_month  integer;
BEGIN
  INSERT INTO voice_credits (account_id, period_month, reset_at)
  VALUES (p_account_id, v_period, date_trunc('month', now()) + interval '1 month')
  ON CONFLICT (account_id, period_month) DO NOTHING;

  SELECT * INTO v_credit_row FROM voice_credits
   WHERE account_id = p_account_id AND period_month = v_period
   FOR UPDATE;

  v_available := v_credit_row.credits_included_cents + v_credit_row.credits_purchased_cents - v_credit_row.credits_used_cents;

  IF v_available < v_althos_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'available_cents', v_available);
  END IF;

  -- Limites de segurança configurados pela organização (diário/mensal/por-chamada).
  SELECT limits INTO v_limits FROM voice_accounts WHERE organization_id = p_organization_id;
  IF v_limits IS NOT NULL THEN
    IF (v_limits->>'per_call_cents') IS NOT NULL AND v_althos_cost > (v_limits->>'per_call_cents')::integer THEN
      RETURN jsonb_build_object('success', false, 'error', 'per_call_limit_exceeded');
    END IF;
    IF (v_limits->>'daily_cents') IS NOT NULL THEN
      SELECT COALESCE(SUM(-althos_cost_cents), 0) INTO v_spent_today
        FROM voice_credit_transactions
       WHERE account_id = p_account_id AND type = 'consumed' AND created_at >= date_trunc('day', now());
      IF v_spent_today + v_althos_cost > (v_limits->>'daily_cents')::integer THEN
        RETURN jsonb_build_object('success', false, 'error', 'daily_limit_exceeded');
      END IF;
    END IF;
    IF (v_limits->>'monthly_cents') IS NOT NULL THEN
      SELECT COALESCE(SUM(-althos_cost_cents), 0) INTO v_spent_month
        FROM voice_credit_transactions
       WHERE account_id = p_account_id AND type = 'consumed' AND created_at >= date_trunc('month', now());
      IF v_spent_month + v_althos_cost > (v_limits->>'monthly_cents')::integer THEN
        RETURN jsonb_build_object('success', false, 'error', 'monthly_limit_exceeded');
      END IF;
    END IF;
  END IF;

  UPDATE voice_credits SET credits_used_cents = credits_used_cents + v_althos_cost WHERE id = v_credit_row.id;

  INSERT INTO voice_credit_transactions
    (account_id, voice_credits_id, type, usage_type, voice_call_id, provider_cost_cents, althos_cost_cents, balance_after_cents, metadata)
  VALUES
    (p_account_id, v_credit_row.id, 'consumed', p_usage_type, p_voice_call_id, p_provider_cost_cents, -v_althos_cost, v_available - v_althos_cost, p_metadata);

  RETURN jsonb_build_object('success', true, 'althos_cost_cents', v_althos_cost, 'remaining_cents', v_available - v_althos_cost);
END;
$$;

COMMENT ON FUNCTION consume_voice_credits IS 'Debita atomicamente (FOR UPDATE) o saldo de Voice Credits de uma conta, aplicando markup e checando limites de segurança da organização. Nunca chamar UPDATE direto em voice_credits.credits_used_cents fora desta função.';
