-- Dashboard aggregations
-- Replaces "fetch all rows + reduce in JS" patterns in actions/dashboard.ts
-- with grouped/aggregated queries that scale with row count, not page size.
--
-- All functions are SECURITY INVOKER (the default), so RLS still applies — the
-- caller must be a member of the organization.

-- 1. Total revenue (sum of value_cents) for leads currently in the "closed"
--    stage and updated in the given window.
CREATE OR REPLACE FUNCTION dashboard_revenue(
  p_org_id UUID,
  p_stage_id UUID,
  p_start TIMESTAMPTZ
)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(value_cents), 0)::BIGINT
  FROM leads
  WHERE organization_id = p_org_id
    AND stage_id = p_stage_id
    AND updated_at >= p_start;
$$;

GRANT EXECUTE ON FUNCTION dashboard_revenue(UUID, UUID, TIMESTAMPTZ) TO authenticated;

-- 2. Funnel: count of leads per stage, ordered by stage position. Returns
--    every stage even when count = 0 via LEFT JOIN.
-- "position" is a reserved word in Postgres function return types — alias it
-- as stage_position so the RETURNS TABLE definition parses cleanly.
CREATE OR REPLACE FUNCTION dashboard_funnel(p_org_id UUID)
RETURNS TABLE (
  stage_id UUID,
  name TEXT,
  stage_position INT,
  count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT s.id AS stage_id, s.name, s.position AS stage_position, COUNT(l.id)::BIGINT AS count
  FROM pipeline_stages s
  LEFT JOIN leads l
    ON l.stage_id = s.id
   AND l.organization_id = p_org_id
  WHERE s.pipeline_id IN (
    SELECT id FROM pipelines WHERE organization_id = p_org_id
  )
  GROUP BY s.id, s.name, s.position
  ORDER BY s.position;
$$;

GRANT EXECUTE ON FUNCTION dashboard_funnel(UUID) TO authenticated;

-- 3. Lead sources: count of leads per source within the given window.
CREATE OR REPLACE FUNCTION dashboard_lead_sources(
  p_org_id UUID,
  p_start TIMESTAMPTZ
)
RETURNS TABLE (
  name TEXT,
  value BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(source, 'Não informado') AS name, COUNT(*)::BIGINT AS value
  FROM leads
  WHERE organization_id = p_org_id
    AND created_at >= p_start
  GROUP BY COALESCE(source, 'Não informado')
  ORDER BY value DESC;
$$;

GRANT EXECUTE ON FUNCTION dashboard_lead_sources(UUID, TIMESTAMPTZ) TO authenticated;

-- 4. Leads time series: count per (day, stage) within the given window.
--    Days are bucketed in the org's timezone... we use UTC here; if the
--    front-end needs a different zone, pass it in or convert client-side.
CREATE OR REPLACE FUNCTION dashboard_leads_timeseries(
  p_org_id UUID,
  p_start TIMESTAMPTZ
)
RETURNS TABLE (
  bucket DATE,
  stage_id UUID,
  stage_name TEXT,
  count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (l.created_at AT TIME ZONE 'UTC')::DATE AS bucket,
    l.stage_id,
    s.name AS stage_name,
    COUNT(*)::BIGINT AS count
  FROM leads l
  LEFT JOIN pipeline_stages s ON s.id = l.stage_id
  WHERE l.organization_id = p_org_id
    AND l.created_at >= p_start
  GROUP BY bucket, l.stage_id, s.name
  ORDER BY bucket;
$$;

GRANT EXECUTE ON FUNCTION dashboard_leads_timeseries(UUID, TIMESTAMPTZ) TO authenticated;
