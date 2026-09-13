-- ============================================================================
-- 0245_voice_credits_idempotency.sql
-- Fase 4 do pedido de pricing/billing: leva o mesmo rigor do Credit Engine
-- (idempotência + refund) para o ledger de Voice/SMS — SEM misturá-lo com
-- Althos Credits (decisão da migration 0244, mantida: voice_credits continua
-- um ledger 100% separado, em centavos, nunca compartilha saldo com IA).
--
-- Gap real encontrado na auditoria: consume_voice_credits não tinha proteção
-- de idempotência (um retry de step.run do Inngest, ex. depois de uma falha
-- de rede na chamada ao provider Twilio, re-executa a função inteira e
-- debitaria de novo) nem função de estorno (se o provider falhar DEPOIS do
-- débito, o cliente perdia o crédito sem receber a chamada/SMS).
--
-- NÃO É DESTRUTIVA: só ADD COLUMN + CREATE OR REPLACE FUNCTION + função nova.
-- ============================================================================

alter table public.voice_credit_transactions
  add column if not exists idempotency_key text,
  add column if not exists refund_of       uuid references public.voice_credit_transactions(id);

create unique index if not exists idx_voice_credit_tx_idempotency
  on public.voice_credit_transactions(idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_voice_credit_tx_refund_of
  on public.voice_credit_transactions(refund_of)
  where refund_of is not null;

-- ----------------------------------------------------------------------------
-- consume_voice_credits — agora idempotente e retorna o id da transação
-- (necessário para permitir estorno pontual dessa transação específica).
--
-- IMPORTANTE: CREATE OR REPLACE não substitui uma função se a lista de tipos
-- de parâmetro mudar (adicionar p_idempotency_key muda a assinatura) — ele
-- CRIA UMA SEGUNDA função sobrecarregada, órfã, exatamente como o bug já
-- cometido e corrigido na migration 0244 (consume_ai_credits/p_lead_id).
-- Por isso o DROP explícito da assinatura antiga vem primeiro aqui.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.consume_voice_credits(uuid, uuid, text, integer, numeric, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.consume_voice_credits(
  p_account_id          uuid,
  p_organization_id     uuid,
  p_usage_type          text,
  p_provider_cost_cents integer,
  p_markup_pct          numeric DEFAULT 30,
  p_voice_call_id       uuid DEFAULT NULL,
  p_metadata            jsonb DEFAULT '{}',
  p_idempotency_key     text DEFAULT NULL
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
  v_existing     voice_credit_transactions%ROWTYPE;
  v_tx_id        uuid;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM voice_credit_transactions
     WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'althos_cost_cents', -v_existing.althos_cost_cents,
        'remaining_cents', v_existing.balance_after_cents,
        'transaction_id', v_existing.id,
        'idempotent_replay', true
      );
    END IF;
  END IF;

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
    (account_id, voice_credits_id, type, usage_type, voice_call_id, provider_cost_cents, althos_cost_cents, balance_after_cents, metadata, idempotency_key)
  VALUES
    (p_account_id, v_credit_row.id, 'consumed', p_usage_type, p_voice_call_id, p_provider_cost_cents, -v_althos_cost, v_available - v_althos_cost, p_metadata, p_idempotency_key)
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object('success', true, 'althos_cost_cents', v_althos_cost, 'remaining_cents', v_available - v_althos_cost, 'transaction_id', v_tx_id);
END;
$$;

COMMENT ON FUNCTION public.consume_voice_credits IS 'Debita atomicamente (FOR UPDATE) o saldo de Voice Credits de uma conta, aplicando markup e checando limites de segurança. Idempotente via p_idempotency_key (migration 0245). Nunca chamar UPDATE direto em voice_credits.credits_used_cents fora desta função.';

-- ----------------------------------------------------------------------------
-- refund_voice_credits — estorno de uma transação de consumo específica.
-- Usado quando o provider (Twilio) falha DEPOIS do débito (chamada não
-- completou / SMS não foi enviado) — o cliente não deve pagar por um
-- recurso que não recebeu.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_voice_credits(
  p_transaction_id uuid,
  p_reason         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_tx      voice_credit_transactions%ROWTYPE;
  v_amount  integer;
BEGIN
  SELECT * INTO v_tx FROM voice_credit_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'transaction_not_found');
  END IF;
  IF v_tx.type <> 'consumed' OR v_tx.althos_cost_cents >= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_refundable');
  END IF;
  IF EXISTS (SELECT 1 FROM voice_credit_transactions WHERE refund_of = p_transaction_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_refunded');
  END IF;

  v_amount := -v_tx.althos_cost_cents;

  UPDATE voice_credits SET credits_used_cents = GREATEST(0, credits_used_cents - v_amount)
   WHERE id = v_tx.voice_credits_id;

  INSERT INTO voice_credit_transactions
    (account_id, voice_credits_id, type, usage_type, voice_call_id, provider_cost_cents, althos_cost_cents, balance_after_cents, metadata, refund_of)
  SELECT
    v_tx.account_id, v_tx.voice_credits_id, 'refunded', v_tx.usage_type, v_tx.voice_call_id, 0, v_amount,
    (SELECT credits_included_cents + credits_purchased_cents - credits_used_cents FROM voice_credits WHERE id = v_tx.voice_credits_id),
    jsonb_build_object('reason', p_reason), p_transaction_id;

  RETURN jsonb_build_object('success', true, 'refunded_cents', v_amount);
END;
$$;

COMMENT ON FUNCTION public.refund_voice_credits IS 'Estorna uma transação de consumo do Voice Credits (1 estorno por transação, migration 0245) — usar quando o provider falha depois do débito.';
