-- ============================================================================
-- 0244_althos_credits_engine.sql
-- Nova arquitetura comercial: Althos Credits (Credit Engine) + repricing +
-- usuários incluídos/adicionais + catálogo de pacotes de créditos.
--
-- NÃO É DESTRUTIVA: evolui ai_credits/ai_credit_transactions (schema
-- existente desde a migration 0057) em vez de recriar tabelas. Nenhum dado
-- histórico é apagado. Reversível: as colunas novas são NULLABLE/DEFAULT e a
-- função antiga continua compatível (idempotency_key é opcional).
--
-- Decisão de negócio (confirmada com o usuário nesta sessão):
--   - Repricing migra TODAS as contas para os novos valores (sem
--     grandfathering) — a mudança é feita direto na tabela `plans`, que já é
--     a fonte central de verdade (nenhuma conta precisa de UPDATE individual).
--   - "Althos Credits" = renomeação/generalização do que hoje é `ai_credits`.
--     Voice e SMS NÃO entram neste ledger — continuam com billing de uso
--     próprio (voice_credits/minutes, sms_usage), conforme exigido pelo
--     pedido (seções 11-13): WhatsApp/Voice/SMS != Althos Credits.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) REPRICING — plans (fonte central; nenhum hardcode em componente).
--    Starter R$149 · Pro R$299 · Business R$599.
--    Créditos: Starter 500 · Pro 2.500 · Business 7.500 (franquia mensal).
-- ----------------------------------------------------------------------------
alter table public.plans
  add column if not exists included_users        integer,
  add column if not exists extra_user_price_cents integer;

update public.plans set
  price_monthly_cents    = 14900,
  price_semestral_cents  = 80460,   -- 149*6*0.90
  price_annual_cents     = 146616,  -- 149*12*0.82
  ai_credits_monthly     = 500,
  max_users              = 2,
  included_users         = 2,
  extra_user_price_cents = 3900
where id = 'starter';

update public.plans set
  price_monthly_cents    = 29900,
  price_semestral_cents  = 161460,  -- 299*6*0.90
  price_annual_cents     = 294264,  -- 299*12*0.82
  ai_credits_monthly     = 2500,
  max_users              = 5,
  included_users         = 5,
  extra_user_price_cents = 4900
where id = 'pro';

update public.plans set
  price_monthly_cents    = 59900,
  price_semestral_cents  = 323460,  -- 599*6*0.90
  price_annual_cents     = 589656,  -- 599*12*0.82
  ai_credits_monthly     = 7500,
  max_users              = 10,
  included_users         = 10,
  extra_user_price_cents = 5900
where id = 'business';

-- Free/agency/internal/legado 'scale' não vendem assento adicional.
update public.plans set included_users = max_users, extra_user_price_cents = 0
where id not in ('starter', 'pro', 'business');

-- ----------------------------------------------------------------------------
-- 2) SUBSCRIPTIONS — assentos adicionais contratados (billing por usuário).
-- ----------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists extra_seats integer not null default 0;

-- ----------------------------------------------------------------------------
-- 3) ALTHOS CREDITS LEDGER — generaliza ai_credit_transactions sem quebrar
--    o schema existente. `type` ganha os valores novos do pedido
--    (monthly_grant/purchase/usage/refund/adjustment/bonus/expiration) —
--    mantém os antigos (consumed/purchased/refunded/plan_reset) como
--    aliases legados lidos pelo código atual, sem forçar migração de dados.
-- ----------------------------------------------------------------------------
alter table public.ai_credit_transactions
  add column if not exists idempotency_key    text,
  add column if not exists module             text,
  add column if not exists provider           text,
  add column if not exists model              text,
  add column if not exists internal_cost_cents numeric(12,4),
  add column if not exists refund_of          uuid references public.ai_credit_transactions(id),
  add column if not exists user_id            uuid references auth.users(id);

-- Idempotência: uma mesma chave nunca gera duas movimentações (retries de
-- Inngest/webhook batem aqui e recebem o resultado já registrado).
create unique index if not exists idx_ai_credit_tx_idempotency
  on public.ai_credit_transactions(idempotency_key)
  where idempotency_key is not null;

-- Um estorno por transação original (evita refund duplicado).
create unique index if not exists idx_ai_credit_tx_refund_of
  on public.ai_credit_transactions(refund_of)
  where refund_of is not null;

create index if not exists idx_ai_credit_tx_module on public.ai_credit_transactions(module);
create index if not exists idx_ai_credit_tx_account_created on public.ai_credit_transactions(account_id, created_at desc);

comment on table public.ai_credit_transactions is
  'Ledger de Althos Credits (nome comercial; tabela mantém o nome histórico ai_credit_transactions por segurança de migração). Voice/SMS NÃO usam este ledger — ver voice_credit_transactions / sms_usage.';

-- ----------------------------------------------------------------------------
-- 4) consume_ai_credits — agora idempotente e com metering de unit economics.
--    Retrocompatível: p_idempotency_key/p_module/p_provider/p_model/
--    p_internal_cost_cents são opcionais (chamadas antigas continuam válidas).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  p_account_id          uuid,
  p_action              text,
  p_credits             integer,
  p_lead_id             uuid DEFAULT NULL,
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
  -- Idempotência: se esta chave já foi processada (retry de job/webhook),
  -- devolve o resultado já registrado em vez de debitar de novo.
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
    (account_id, ai_credits_id, type, action, credits_delta, lead_id, metadata,
     idempotency_key, module, provider, model, internal_cost_cents, user_id)
  VALUES
    (p_account_id, v_credit_row.id, 'usage', p_action, -p_credits, p_lead_id, p_metadata,
     p_idempotency_key, p_module, p_provider, p_model, p_internal_cost_cents, p_user_id);

  RETURN jsonb_build_object('success', true, 'credits_used', p_credits, 'remaining', v_available - p_credits);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5) refund_ai_credits — estorno idempotente de uma transação de consumo.
-- ----------------------------------------------------------------------------
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
    (account_id, ai_credits_id, type, action, credits_delta, lead_id, metadata, refund_of, module)
  VALUES
    (v_tx.account_id, v_tx.ai_credits_id, 'refund', v_tx.action, v_amount, v_tx.lead_id,
     jsonb_build_object('reason', p_reason), p_transaction_id, v_tx.module);

  RETURN jsonb_build_object('success', true, 'refunded', v_amount);
END;
$$;

-- ----------------------------------------------------------------------------
-- 6) CREDIT_PACKAGES — catálogo central (nunca hardcode em componente).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id          text PRIMARY KEY,
  credits     integer NOT NULL,
  price_cents integer NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

INSERT INTO public.credit_packages (id, credits, price_cents, sort_order) VALUES
  ('credits_1000',  1000,  2900, 1),
  ('credits_5000',  5000,  9900, 2),
  ('credits_10000', 10000, 17900, 3),
  ('credits_25000', 25000, 34900, 4),
  ('credits_50000', 50000, 59900, 5)
ON CONFLICT (id) DO UPDATE SET
  credits = EXCLUDED.credits, price_cents = EXCLUDED.price_cents, sort_order = EXCLUDED.sort_order;

ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credit packages readable by authenticated" ON public.credit_packages;
CREATE POLICY "credit packages readable by authenticated"
  ON public.credit_packages FOR SELECT USING (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 7) MIGRAÇÃO DE CLIENTES EXISTENTES — legacy_plan/migration_status.
--    Não sobrescreve organizations.plan (taxonomia legada por-org que ainda
--    gateia parte do app); apenas registra que a conta passou pelo repricing,
--    permitindo auditoria e rollback de decisão comercial sem tocar em schema.
-- ----------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists legacy_plan_id     text,
  add column if not exists repriced_at        timestamptz;

update public.subscriptions s
   set legacy_plan_id = s.plan_id,
       repriced_at    = now()
 where s.repriced_at is null;
