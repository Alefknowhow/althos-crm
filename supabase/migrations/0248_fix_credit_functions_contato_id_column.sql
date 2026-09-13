-- ============================================================================
-- 0248_fix_credit_functions_contato_id_column.sql
-- Bug crítico encontrado na Fase 7 (testes do Credit Engine): a migration
-- 0244 reescreveu consume_ai_credits()/refund_ai_credits() com um INSERT
-- que referenciava a coluna "lead_id" em ai_credit_transactions — mas a
-- coluna real (desde a migration 0073, rename leads->contatos) é
-- "contato_id". Toda vez que o consumo/estorno passasse do check inicial
-- (ou seja, todo consumo BEM-SUCEDIDO, não só o caminho de saldo
-- insuficiente) lançava erro 42703 em vez de debitar/estornar.
--
-- Como os smoke-tests anteriores (migration 0244/fixup) só exercitaram o
-- caminho de saldo insuficiente (que retorna ANTES do INSERT problemático),
-- o bug passou despercebido até a Fase 7 rodar um cenário de consumo
-- bem-sucedido de verdade.
--
-- Corrigido: contato_id no lugar de lead_id nos dois INSERTs. Também
-- adiciona `transaction_id` ao retorno de sucesso de consume_ai_credits
-- (faltava — sem isso não havia como chamar refund_ai_credits depois).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  p_account_id          uuid,
  p_action              text,
  p_credits             integer,
  p_contato_id          uuid DEFAULT NULL,
  p_metadata            jsonb DEFAULT '{}',
  p_idempotency_key     text DEFAULT NULL,
  p_module              text DEFAULT NULL,
  p_provider            text DEFAULT NULL,
  p_model               text DEFAULT NULL,
  p_internal_cost_cents numeric DEFAULT NULL,
  p_user_id             uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_period       text := to_char(now(), 'YYYY-MM');
  v_credit_row   ai_credits%ROWTYPE;
  v_available    integer;
  v_existing     ai_credit_transactions%ROWTYPE;
BEGIN
  IF current_user_is_super_admin() THEN
    RETURN jsonb_build_object('success', true, 'credits_used', 0, 'remaining', 999999, 'bypass', true);
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM ai_credit_transactions
     WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'credits_used', -v_existing.credits_delta,
        'remaining', NULL,
        'idempotent_replay', true
      );
    END IF;
  END IF;

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
    (account_id, ai_credits_id, type, action, credits_delta, contato_id, metadata,
     idempotency_key, module, provider, model, internal_cost_cents, user_id)
  VALUES
    (p_account_id, v_credit_row.id, 'usage', p_action, -p_credits, p_contato_id, p_metadata,
     p_idempotency_key, p_module, p_provider, p_model, p_internal_cost_cents, p_user_id)
  RETURNING id INTO v_existing.id;

  RETURN jsonb_build_object('success', true, 'credits_used', p_credits, 'remaining', v_available - p_credits, 'transaction_id', v_existing.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_ai_credits(
  p_transaction_id uuid,
  p_reason         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_tx      ai_credit_transactions%ROWTYPE;
  v_amount  integer;
BEGIN
  SELECT * INTO v_tx FROM ai_credit_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'transaction_not_found');
  END IF;
  IF v_tx.type <> 'usage' OR v_tx.credits_delta >= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_refundable');
  END IF;
  IF EXISTS (SELECT 1 FROM ai_credit_transactions WHERE refund_of = p_transaction_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_refunded');
  END IF;

  v_amount := -v_tx.credits_delta;

  UPDATE ai_credits SET credits_used = GREATEST(0, credits_used - v_amount)
   WHERE id = v_tx.ai_credits_id;

  INSERT INTO ai_credit_transactions
    (account_id, ai_credits_id, type, action, credits_delta, contato_id, metadata, refund_of, module)
  VALUES
    (v_tx.account_id, v_tx.ai_credits_id, 'refund', v_tx.action, v_amount, v_tx.contato_id,
     jsonb_build_object('reason', p_reason), p_transaction_id, v_tx.module);

  RETURN jsonb_build_object('success', true, 'refunded', v_amount);
END;
$$;
