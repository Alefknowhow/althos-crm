-- Bloco 3.5 — Dashboard pipeline filter.
-- Adds optional p_pipeline_id parameter to every dashboard RPC. When NULL,
-- behaves identically to the previous version (all pipelines in the org).
--
-- We create NEW overloads instead of dropping/recreating so existing callers
-- keep working during deploy. The dashboard action layer will switch to the
-- new signature.

CREATE OR REPLACE FUNCTION dashboard_revenue(
  p_org_id UUID,
  p_stage_id UUID,
  p_start TIMESTAMPTZ,
  p_pipeline_id UUID DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(l.value_cents), 0)::BIGINT
  FROM leads l
  WHERE l.organization_id = p_org_id
    AND l.stage_id = p_stage_id
    AND l.updated_at >= p_start
    AND (p_pipeline_id IS NULL OR l.pipeline_id = p_pipeline_id);
$$;

GRANT EXECUTE ON FUNCTION dashboard_revenue(UUID, UUID, TIMESTAMPTZ, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_funnel(
  p_org_id UUID,
  p_pipeline_id UUID DEFAULT NULL
)
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
    SELECT id FROM pipelines
    WHERE organization_id = p_org_id
      AND (p_pipeline_id IS NULL OR id = p_pipeline_id)
  )
  GROUP BY s.id, s.name, s.position
  ORDER BY s.position;
$$;

GRANT EXECUTE ON FUNCTION dashboard_funnel(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_lead_sources(
  p_org_id UUID,
  p_start TIMESTAMPTZ,
  p_pipeline_id UUID DEFAULT NULL
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
    AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
  GROUP BY COALESCE(source, 'Não informado')
  ORDER BY value DESC;
$$;

GRANT EXECUTE ON FUNCTION dashboard_lead_sources(UUID, TIMESTAMPTZ, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION dashboard_leads_timeseries(
  p_org_id UUID,
  p_start TIMESTAMPTZ,
  p_pipeline_id UUID DEFAULT NULL
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
    AND (p_pipeline_id IS NULL OR l.pipeline_id = p_pipeline_id)
  GROUP BY bucket, l.stage_id, s.name
  ORDER BY bucket;
$$;

GRANT EXECUTE ON FUNCTION dashboard_leads_timeseries(UUID, TIMESTAMPTZ, UUID) TO authenticated;
