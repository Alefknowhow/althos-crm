-- Painel operacional do super-admin: assinaturas/planos dos provedores que
-- sustentam a própria plataforma Althos (Supabase, Vercel, Resend, Inngest,
-- Cloudflare, Anthropic, Gemini) — dado global, sem organization_id, visível
-- só a super-admins. Não confundir com ai_credits (billing ao cliente).

CREATE TABLE IF NOT EXISTS platform_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor          TEXT NOT NULL CHECK (vendor IN ('supabase','vercel','resend','inngest','cloudflare','anthropic','gemini','outro')),
    vendor_label    TEXT, -- nome livre quando vendor = 'outro'
    plan_name       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','trial','pausado','cancelado')),
    billing_cycle   TEXT NOT NULL DEFAULT 'mensal' CHECK (billing_cycle IN ('mensal','anual','uso')),
    cost_usd_cents  INTEGER,
    cost_brl_cents  INTEGER,
    fx_rate_used    NUMERIC(10,4),
    started_at      DATE,
    renewed_at      DATE,
    due_date        DATE,
    auto_renew      BOOLEAN NOT NULL DEFAULT true,
    payment_method  TEXT,
    external_url    TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_vendor ON platform_subscriptions (vendor);
CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_due_date ON platform_subscriptions (due_date);
CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_status ON platform_subscriptions (status);

DROP TRIGGER IF EXISTS set_updated_at ON platform_subscriptions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON platform_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS platform_usage_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES platform_subscriptions(id) ON DELETE SET NULL,
    vendor          TEXT NOT NULL CHECK (vendor IN ('supabase','vercel','resend','inngest','cloudflare','anthropic','gemini','outro')),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    metric_label    TEXT NOT NULL,
    metric_value    NUMERIC(16,2) NOT NULL,
    cost_usd_cents  INTEGER,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_usage_logs_subscription ON platform_usage_logs (subscription_id);
CREATE INDEX IF NOT EXISTS idx_platform_usage_logs_vendor ON platform_usage_logs (vendor, period_start DESC);

ALTER TABLE platform_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super admin manage platform subscriptions" ON platform_subscriptions;
CREATE POLICY "super admin manage platform subscriptions" ON platform_subscriptions
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE platform_usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super admin manage platform usage logs" ON platform_usage_logs;
CREATE POLICY "super admin manage platform usage logs" ON platform_usage_logs
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

COMMENT ON TABLE platform_subscriptions IS 'Assinaturas/planos dos provedores de infra da própria plataforma Althos (custo operacional, não billing de cliente).';
COMMENT ON TABLE platform_usage_logs IS 'Snapshots de consumo por período por assinatura de plataforma (tokens de IA, requests, bandwidth, etc).';
