-- Fix: the leads→contatos rename (0070) updated the TS callers of
-- consume_ai_credits to pass p_contato_id, but the SQL function still declared
-- p_lead_id. PostgREST resolves RPCs by argument NAME, so every credit-consuming
-- call (Atendente IA, Insights, lead qualification) failed to match a function
-- and surfaced as the generic "Não foi possível validar seus créditos de IA".
--
-- Renaming a function parameter requires DROP + CREATE (CREATE OR REPLACE cannot
-- change input parameter names). Body, SECURITY DEFINER, search_path and the
-- contato_id column write are preserved verbatim — only p_lead_id → p_contato_id.

DROP FUNCTION IF EXISTS public.consume_ai_credits(uuid, text, integer, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  p_account_id uuid,
  p_action     text,
  p_credits    integer,
  p_contato_id uuid  DEFAULT NULL::uuid,
  p_metadata   jsonb DEFAULT '{}'::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_period     text := to_char(now(), 'YYYY-MM');
  v_credit_row ai_credits%ROWTYPE;
  v_available  integer;
BEGIN
  IF current_user_is_super_admin() THEN
    RETURN jsonb_build_object('success', true, 'credits_used', 0, 'remaining', 999999, 'bypass', true);
  END IF;
  INSERT INTO ai_credits (account_id, period_month, credits_included, reset_at)
  SELECT p_account_id, v_period,
    COALESCE((SELECT pl.ai_credits_monthly FROM plans pl JOIN subscriptions s ON s.plan_id = pl.id
               WHERE s.account_id = p_account_id AND s.status IN ('active','trialing') LIMIT 1), 0),
    date_trunc('month', now()) + interval '1 month'
  ON CONFLICT (account_id, period_month) DO NOTHING;
  SELECT * INTO v_credit_row FROM ai_credits WHERE account_id = p_account_id AND period_month = v_period FOR UPDATE;
  v_available := v_credit_row.credits_included + v_credit_row.credits_purchased - v_credit_row.credits_used;
  IF v_available < p_credits THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'available', v_available);
  END IF;
  UPDATE ai_credits SET credits_used = credits_used + p_credits WHERE id = v_credit_row.id;
  INSERT INTO ai_credit_transactions (account_id, ai_credits_id, type, action, credits_delta, contato_id, metadata)
  VALUES (p_account_id, v_credit_row.id, 'consumed', p_action, -p_credits, p_contato_id, p_metadata);
  RETURN jsonb_build_object('success', true, 'credits_used', p_credits, 'remaining', v_available - p_credits);
END;
$function$;
