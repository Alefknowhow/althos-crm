-- ============================================================================
-- 0064_plans_revamp_semestral.sql
-- Nova estratégia de planos da Althos CRM (junho/2026).
--
--   * Novos preços mensais: Starter R$137 · Pro R$397 · Business R$697.
--   * Novo ciclo SEMESTRAL (−10%) além de mensal e anual (−18%).
--   * Créditos de IA recalibrados (custo Althos ~R$0,03/crédito):
--       Free 0 · Starter 300 · Pro 1.200 · Business 3.000.
--   * Free agora permite 100 leads no pipeline (era 50).
--   * Limites de usuários: Free 1 · Starter 1 · Pro 6 (1 + 5 convidados) · Business ilimitado.
--   * Escolha de modelo de IA por conta (multiplicador de crédito aplicado no app).
--
-- billing_cycle em subscriptions é text livre (sem CHECK), então 'semestral'
-- já é aceito sem DDL adicional.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Coluna de preço semestral no catálogo de planos.
-- ----------------------------------------------------------------------------
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_semestral_cents integer NOT NULL DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 2) Atualiza preços, créditos e limites de cada plano.
--    (UPDATE porque as linhas já existem desde 0057; ON CONFLICT não altera.)
-- ----------------------------------------------------------------------------
UPDATE plans SET
  price_monthly_cents   = 0,
  price_semestral_cents = 0,
  price_annual_cents    = 0,
  ai_credits_monthly    = 0,
  max_leads_per_month   = 100,
  max_users             = 1
WHERE id = 'free';

UPDATE plans SET
  price_monthly_cents   = 13700,
  price_semestral_cents = 73980,
  price_annual_cents    = 134808,
  ai_credits_monthly    = 300,
  max_leads_per_month   = -1,
  max_users             = 1
WHERE id = 'starter';

UPDATE plans SET
  price_monthly_cents   = 39700,
  price_semestral_cents = 214380,
  price_annual_cents    = 390648,
  ai_credits_monthly    = 1200,
  max_leads_per_month   = -1,
  max_users             = 6
WHERE id = 'pro';

UPDATE plans SET
  price_monthly_cents   = 69700,
  price_semestral_cents = 376380,
  price_annual_cents    = 685848,
  ai_credits_monthly    = 3000,
  max_leads_per_month   = -1,
  max_users             = -1
WHERE id = 'business';

-- ----------------------------------------------------------------------------
-- 3) Novos limites estruturados por plano.
--    Convenção: -1 = ilimitado. (max_automations já existe desde 0057.)
-- ----------------------------------------------------------------------------
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_pipelines        integer NOT NULL DEFAULT 1;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_automation_runs  integer NOT NULL DEFAULT 0;  -- disparos/mês
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_social_accounts  integer NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_social_messages  integer NOT NULL DEFAULT 0;  -- DMs/disparos/mês
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_customers        integer NOT NULL DEFAULT 50;

UPDATE plans SET
  max_pipelines = 1, max_automations = 0, max_automation_runs = 0,
  max_social_accounts = 0, max_social_messages = 0, max_customers = 50
WHERE id = 'free';

UPDATE plans SET
  max_pipelines = 2, max_automations = 5, max_automation_runs = 1000,
  max_social_accounts = 1, max_social_messages = 500, max_customers = 500
WHERE id = 'starter';

UPDATE plans SET
  max_pipelines = 5, max_automations = 20, max_automation_runs = 10000,
  max_social_accounts = 3, max_social_messages = 5000, max_customers = 2000
WHERE id = 'pro';

UPDATE plans SET
  max_pipelines = -1, max_automations = -1, max_automation_runs = -1,
  max_social_accounts = -1, max_social_messages = -1, max_customers = -1
WHERE id = 'business';

-- ----------------------------------------------------------------------------
-- 4) Modelo de IA escolhido por CONTA. O multiplicador de crédito
--    (Haiku 1× · Sonnet/GPT-4o 3× · Opus 5×) é aplicado no app (lib/plans).
-- ----------------------------------------------------------------------------
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS preferred_ai_model text NOT NULL DEFAULT 'claude-haiku-4-5';
