-- Super-admin bypass for plan gating.
--
-- The product owner / Althos staff are super-admins (auth app_metadata
-- is_super_admin = true OR role = 'super_admin'). They must keep full access to
-- every feature regardless of the account plan, so internal testing and support
-- are never blocked by billing gates. This is enforced at the SQL layer so even
-- direct RPC calls honor it.

-- Helper: is the CURRENT caller a super-admin? Reads ONLY app_metadata from the
-- verified JWT (never user_metadata, which is self-editable).
CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false
  )
  OR COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin',
    false
  );
$$;

-- ── account_has_feature: super-admin sees everything ──────────────────────────
CREATE OR REPLACE FUNCTION public.account_has_feature(p_account_id uuid, p_feature text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_features jsonb;
BEGIN
  -- Super-admin bypass.
  IF current_user_is_super_admin() THEN
    RETURN true;
  END IF;

  SELECT p.features INTO v_features
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
   WHERE s.account_id = p_account_id
     AND s.status IN ('active', 'trialing')
   ORDER BY s.created_at DESC
   LIMIT 1;

  RETURN COALESCE((v_features->>p_feature)::boolean, false);
END;
$function$;

-- ── consume_ai_credits: super-admin never depletes ────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  p_account_id uuid,
  p_action     text,
  p_credits    integer,
  p_lead_id    uuid DEFAULT NULL::uuid,
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
  -- Super-admin bypass: allow the action, do not debit.
  IF current_user_is_super_admin() THEN
    RETURN jsonb_build_object('success', true, 'credits_used', 0, 'remaining', 999999, 'bypass', true);
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
    (account_id, ai_credits_id, type, action, credits_delta, lead_id, metadata)
  VALUES
    (p_account_id, v_credit_row.id, 'consumed', p_action, -p_credits, p_lead_id, p_metadata);

  RETURN jsonb_build_object('success', true, 'credits_used', p_credits, 'remaining', v_available - p_credits);
END;
$function$;
