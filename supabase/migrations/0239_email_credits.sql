-- Email Credits — cobrança por unidade de e-mail disparado, mesmo padrão de
-- Voice Credits (0228_voice_core.sql): ledger SEPARADO por CONTA, com markup
-- configurável e função race-safe de consumo. Nunca compartilha saldo com
-- créditos de IA nem com Voice Credits.
--
-- Diferença importante em relação a Voice/AI Credits: e-mail custa FRAÇÃO de
-- centavo por unidade (Resend Pro overage: US$0,90/1000 e-mails ≈ R$0,0049
-- por e-mail no câmbio abaixo) — por isso os valores são numeric(12,4), não
-- integer. Colunas integer arredondariam CADA envio pra 1 centavo inteiro,
-- inflando o custo real em várias vezes.
--
-- Custo do provider e câmbio ficam em email_pricing_config, editável só por
-- super-admin — nunca hardcodear em código (mesmo padrão de
-- voice_pricing_config/ai_credit_pricing_settings).

CREATE TABLE IF NOT EXISTS email_pricing_config (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_cost_usd_cents_per_1k numeric NOT NULL DEFAULT 90,  -- Resend Pro overage: US$0,90/1000 e-mails
  usd_to_brl_rate                numeric NOT NULL DEFAULT 5.4,
  markup_pct                     numeric NOT NULL DEFAULT 25,   -- pedido explícito do produto
  updated_at                     timestamptz NOT NULL DEFAULT now()
);
INSERT INTO email_pricing_config (provider_cost_usd_cents_per_1k, usd_to_brl_rate, markup_pct)
SELECT 90, 5.4, 25 WHERE NOT EXISTS (SELECT 1 FROM email_pricing_config);

ALTER TABLE email_pricing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Email pricing config super admin only" ON email_pricing_config FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE email_pricing_config IS
  'Custo do provider (Resend) + câmbio + markup pra Email Credits. 1 linha global, editável só por super-admin. Nunca hardcodear em componentes/actions.';

CREATE TABLE IF NOT EXISTS email_credits (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  period_month             text NOT NULL,
  credits_included_cents   numeric(12,4) NOT NULL DEFAULT 0,  -- 0 na V1: nenhum plano inclui Email Credits de graça
  credits_purchased_cents  numeric(12,4) NOT NULL DEFAULT 0,
  credits_used_cents       numeric(12,4) NOT NULL DEFAULT 0,
  reset_at                 timestamptz NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, period_month)
);
CREATE INDEX IF NOT EXISTS idx_email_credits_account_period ON email_credits(account_id, period_month);

ALTER TABLE email_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account members can view own email credits" ON email_credits FOR SELECT
  USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));
CREATE POLICY "Email credits super admin" ON email_credits FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE email_credits IS
  'Saldo de Email Credits por CONTA/mês, em "centavos de R$" fracionários (numeric(12,4)). Cobrado por e-mail disparado através do pipeline de envio (lib/inngest/functions.ts::sendEmail).';

CREATE TABLE IF NOT EXISTS email_credit_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email_credits_id    uuid REFERENCES email_credits(id),
  type                text NOT NULL,             -- purchased | consumed | refunded
  email_send_id       uuid REFERENCES email_sends(id) ON DELETE SET NULL,
  provider_cost_cents numeric(12,4) NOT NULL DEFAULT 0,
  althos_cost_cents   numeric(12,4) NOT NULL DEFAULT 0,  -- delta real no saldo (negativo em consumo)
  balance_after_cents numeric(12,4) NOT NULL,
  metadata            jsonb DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_credit_tx_account ON email_credit_transactions(account_id);

ALTER TABLE email_credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account members can view own email transactions" ON email_credit_transactions FOR SELECT
  USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));
CREATE POLICY "Email credit transactions super admin" ON email_credit_transactions FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE email_credit_transactions IS
  'Ledger imutável de débitos/créditos do Email Credits — cada linha é um evento; nunca só um UPDATE de saldo.';

CREATE OR REPLACE FUNCTION consume_email_credits(
  p_account_id          uuid,
  p_provider_cost_cents numeric,
  p_markup_pct          numeric DEFAULT 25,
  p_email_send_id       uuid DEFAULT NULL,
  p_metadata            jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_period       text := to_char(now(), 'YYYY-MM');
  v_credit_row   email_credits%ROWTYPE;
  v_available    numeric;
  v_althos_cost  numeric := round(p_provider_cost_cents * (1 + p_markup_pct / 100.0), 4);
BEGIN
  IF current_user_is_super_admin() THEN
    RETURN jsonb_build_object('success', true, 'althos_cost_cents', 0, 'remaining_cents', 999999, 'bypass', true);
  END IF;

  INSERT INTO email_credits (account_id, period_month, reset_at)
  VALUES (p_account_id, v_period, date_trunc('month', now()) + interval '1 month')
  ON CONFLICT (account_id, period_month) DO NOTHING;

  SELECT * INTO v_credit_row FROM email_credits
   WHERE account_id = p_account_id AND period_month = v_period
   FOR UPDATE;

  v_available := v_credit_row.credits_included_cents + v_credit_row.credits_purchased_cents - v_credit_row.credits_used_cents;

  IF v_available < v_althos_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'available_cents', v_available);
  END IF;

  UPDATE email_credits SET credits_used_cents = credits_used_cents + v_althos_cost WHERE id = v_credit_row.id;

  INSERT INTO email_credit_transactions
    (account_id, email_credits_id, type, email_send_id, provider_cost_cents, althos_cost_cents, balance_after_cents, metadata)
  VALUES
    (p_account_id, v_credit_row.id, 'consumed', p_email_send_id, p_provider_cost_cents, -v_althos_cost, v_available - v_althos_cost, p_metadata);

  RETURN jsonb_build_object('success', true, 'althos_cost_cents', v_althos_cost, 'remaining_cents', v_available - v_althos_cost);
END;
$$;

COMMENT ON FUNCTION consume_email_credits IS
  'Debita atomicamente (FOR UPDATE) o saldo de Email Credits de uma conta, em numeric(12,4) pra não perder fração de centavo por e-mail (custo real é sub-centavo). Super-admin sempre passa. Nunca chamar UPDATE direto fora desta função.';
