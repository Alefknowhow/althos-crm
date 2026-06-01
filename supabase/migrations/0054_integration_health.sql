-- ---------------------------------------------------------------------------
-- 0054_integration_health
--
-- Powers the "Health Check das Integrações" panel
-- (/app/[orgSlug]/configuracoes/integracoes/saude).
--
-- A row is written every time an integration is probed (cron every 15 min, or
-- on-demand via the "Verificar agora" button). The page reads the *latest* row
-- per (organization_id, integration_name) for current status, and the last 30
-- days of rows to draw the availability chart.
--
-- Writes are performed exclusively by the service-role client (Inngest cron /
-- server action), so only a SELECT policy is needed for tenant members.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.integration_health_checks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- 'whatsapp' | 'email' | 'inngest' | 'supabase'
  integration_name TEXT        NOT NULL,
  -- 'healthy' | 'warning' | 'error' | 'disconnected'
  status           TEXT        NOT NULL CHECK (status IN ('healthy', 'warning', 'error', 'disconnected')),
  -- Structured detail of every sub-check performed (token válido, webhook ativo…)
  details_json     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "Latest status per integration" and "last 30 days for org" both hit this index.
CREATE INDEX IF NOT EXISTS idx_ihc_org_integration_checked
  ON public.integration_health_checks (organization_id, integration_name, checked_at DESC);

-- Retention sweep (delete rows older than N days) scans by checked_at alone.
CREATE INDEX IF NOT EXISTS idx_ihc_checked_at
  ON public.integration_health_checks (checked_at);

-- RLS: tenant members may read their org's health history. No INSERT/UPDATE
-- policy on purpose — only the service-role writer touches this table.
ALTER TABLE public.integration_health_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_health" ON public.integration_health_checks;
CREATE POLICY "org_members_read_health"
  ON public.integration_health_checks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Daily availability aggregation for the 30-day chart.
--
-- Aggregates in the database so the page never pulls thousands of raw rows
-- (96 checks/day × 4 integrations × 30 days ≈ 11k rows/org otherwise).
--
-- SECURITY INVOKER (default): the table's RLS still applies, so a caller can
-- only aggregate orgs they are a member of even though p_org is explicit.
-- "Up" = healthy or warning (degraded but functioning); error/disconnected = down.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.health_availability_daily(p_org UUID, p_days INT DEFAULT 30)
RETURNS TABLE (
  day              DATE,
  integration_name TEXT,
  total            BIGINT,
  up               BIGINT,
  uptime_pct       NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    date_trunc('day', checked_at)::date                                          AS day,
    integration_name,
    count(*)                                                                     AS total,
    count(*) FILTER (WHERE status IN ('healthy', 'warning'))                     AS up,
    round(
      100.0 * count(*) FILTER (WHERE status IN ('healthy', 'warning'))
        / nullif(count(*), 0),
      1
    )                                                                            AS uptime_pct
  FROM public.integration_health_checks
  WHERE organization_id = p_org
    AND checked_at >= now() - make_interval(days => p_days)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;
