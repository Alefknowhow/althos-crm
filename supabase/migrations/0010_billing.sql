-- Add billing columns to organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'self_signup' CHECK (account_type IN ('althos_managed','self_signup','internal')),
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free_trial',
ADD COLUMN IF NOT EXISTS limit_leads INT,
ADD COLUMN IF NOT EXISTS limit_whatsapp_monthly INT,
ADD COLUMN IF NOT EXISTS limit_email_monthly INT,
ADD COLUMN IF NOT EXISTS limit_users INT,
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'no_billing' CHECK (subscription_status IN ('trialing','active','past_due','canceled','no_billing')),
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS billing_managed_externally BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Table: usage_counters
CREATE TABLE IF NOT EXISTS usage_counters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    whatsapp_count INTEGER DEFAULT 0,
    email_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_org_period ON usage_counters(organization_id, period_start);

-- Table: billing_events
CREATE TABLE IF NOT EXISTS billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function: get_plan_limits
CREATE OR REPLACE FUNCTION get_plan_limits(plan_name TEXT)
RETURNS TABLE(leads INT, whatsapp INT, email INT, users INT) AS $$
BEGIN
  RETURN QUERY SELECT 
    CASE 
      WHEN plan_name = 'althos_starter' THEN 500
      WHEN plan_name = 'althos_growth' THEN 2500
      WHEN plan_name = 'althos_performance' THEN 50000
      WHEN plan_name = 'free_trial' THEN 100
      WHEN plan_name = 'saas_starter' THEN 1000
      WHEN plan_name = 'saas_pro' THEN 10000
      WHEN plan_name = 'internal' THEN 1000000
      ELSE 0
    END as leads,
    CASE 
      WHEN plan_name = 'althos_starter' THEN 2000
      WHEN plan_name = 'althos_growth' THEN 10000
      WHEN plan_name = 'althos_performance' THEN 30000
      WHEN plan_name = 'free_trial' THEN 100
      WHEN plan_name = 'saas_starter' THEN 1000
      WHEN plan_name = 'saas_pro' THEN 10000
      WHEN plan_name = 'internal' THEN 1000000
      ELSE 0
    END as whatsapp,
    CASE 
      WHEN plan_name = 'althos_starter' THEN 2000
      WHEN plan_name = 'althos_growth' THEN 10000
      WHEN plan_name = 'althos_performance' THEN 30000
      WHEN plan_name = 'free_trial' THEN 100
      WHEN plan_name = 'saas_starter' THEN 1000
      WHEN plan_name = 'saas_pro' THEN 10000
      WHEN plan_name = 'internal' THEN 1000000
      ELSE 0
    END as email,
    CASE 
      WHEN plan_name = 'althos_starter' THEN 2
      WHEN plan_name = 'althos_growth' THEN 5
      WHEN plan_name = 'althos_performance' THEN 10
      WHEN plan_name = 'free_trial' THEN 1
      WHEN plan_name = 'saas_starter' THEN 1
      WHEN plan_name = 'saas_pro' THEN 5
      WHEN plan_name = 'internal' THEN 100
      ELSE 0
    END as users;
END;
$$ LANGUAGE plpgsql;
