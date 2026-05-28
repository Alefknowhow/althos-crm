-- Bloco Marketing v1
-- Three tables: ad_accounts (Meta/Google account), campaigns (one per campaign),
-- campaign_metrics_daily (one row per campaign × date × source).
--
-- Attribution to leads happens via campaigns.utm_campaign matching
-- form_submissions.utm_campaign or leads.source — no FK, joined at query time.

CREATE TABLE IF NOT EXISTS ad_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('meta', 'google', 'tiktok', 'other')),
    name TEXT NOT NULL,
    external_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_org ON ad_accounts (organization_id);

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ad_account_id UUID NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
    external_id TEXT,
    name TEXT NOT NULL,
    objective TEXT, -- 'leads', 'traffic', 'conversions', 'awareness', etc.
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    -- utm_campaign string we expect to match in form submissions / lead.source.
    -- The user is responsible for setting this so attribution can fire.
    utm_campaign TEXT,
    color TEXT DEFAULT '#3b82f6',
    started_at DATE,
    ended_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns (organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_account ON campaigns (ad_account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_utm ON campaigns (organization_id, utm_campaign);

CREATE TABLE IF NOT EXISTS campaign_metrics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    impressions INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    spend_cents INTEGER NOT NULL DEFAULT 0,
    -- 'manual' = digitado, 'csv' = importado, 'api' = sincronizado.
    -- Permite saber a procedência e refazer a partir do CSV sem perder manual.
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'api')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, date, source)
);

CREATE INDEX IF NOT EXISTS idx_metrics_campaign_date
  ON campaign_metrics_daily (campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_org_date
  ON campaign_metrics_daily (organization_id, date DESC);

-- RLS
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ad accounts access" ON ad_accounts;
CREATE POLICY "Ad accounts access" ON ad_accounts FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "Campaigns access" ON campaigns;
CREATE POLICY "Campaigns access" ON campaigns FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "Campaign metrics access" ON campaign_metrics_daily;
CREATE POLICY "Campaign metrics access" ON campaign_metrics_daily FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

-- updated_at triggers (reusing the function from earlier migrations)
DROP TRIGGER IF EXISTS update_ad_accounts_updated_at ON ad_accounts;
CREATE TRIGGER update_ad_accounts_updated_at
  BEFORE UPDATE ON ad_accounts
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_metrics_daily_updated_at ON campaign_metrics_daily;
CREATE TRIGGER update_campaign_metrics_daily_updated_at
  BEFORE UPDATE ON campaign_metrics_daily
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
