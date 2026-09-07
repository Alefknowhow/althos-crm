-- Reformulação de preços/limites (documentada em docs/plano-precos/).
-- Resumo: Starter sobe pra R$167 e ganha canais reais (WhatsApp+Instagram+
-- campanhas de e-mail) com teto de uso em vez de feature travada; créditos
-- de IA recalculados como 5% do valor do plano, ao custo real do token
-- (R$0,01215/crédito, ver ai_credit_pricing_settings); clientes cadastrados
-- deixam de ter teto (substituído por storage de mídia); formulários e
-- e-mail marketing ganham teto por plano.

alter table public.plans
  add column if not exists max_storage_mb integer,
  add column if not exists max_email_sends integer;

-- Starter — R$167/mês (era R$137)
update public.plans set
  price_monthly_cents   = 16700,
  price_semestral_cents = 90180,   -- 167*6*0.90
  price_annual_cents    = 164328,  -- 167*12*0.82
  ai_credits_monthly    = 700,     -- 5% de R$167 ÷ R$0,01215/crédito
  max_forms             = 10,
  max_customers         = -1,      -- sem teto — vira storage
  max_storage_mb        = 2048,    -- 2GB
  max_email_sends       = 300,
  features = features || jsonb_build_object(
    'whatsapp', true,
    'instagram_automation', true,
    'bulk_campaigns', true
  )
where id = 'starter';

-- Pro — preço mantido (R$397), só créditos/limites mudam. max_tenants
-- corrigido pra 5: estava 1 no banco, divergindo do que o código
-- (lib/plans/config.ts) e a descrição do plano ("até 5 orgs") já assumiam.
update public.plans set
  ai_credits_monthly = 1650,  -- 5% de R$397 ÷ R$0,01215/crédito
  max_forms          = 20,
  max_social_messages = 1000,
  max_customers       = -1,
  max_storage_mb      = 5120,  -- 5GB
  max_email_sends     = 1000,
  max_tenants         = 5
where id = 'pro';

-- Business — preço mantido (R$697); max_tenants corrigido pra -1
-- (ilimitado) — estava 5 no banco, divergindo do que o código já assumia
-- (lib/plans/config.ts) e da própria descrição do plano ("orgs ilimitadas").
update public.plans set
  ai_credits_monthly = 2900,  -- 5% de R$697 ÷ R$0,01215/crédito
  max_users          = 20,    -- era ilimitado — acima disso, plano sob medida
  max_tenants        = -1,
  max_storage_mb      = 15360, -- 15GB
  max_email_sends     = 5000
where id = 'business';
