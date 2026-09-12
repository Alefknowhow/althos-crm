-- Agrega em 1 query o que lib/inngest/alerts-cron.ts fazia como 2 counts
-- por org ativa (achado 1.4 da auditoria de performance) — total de leads e
-- leads com atividade recente, por organização, num único round-trip.

CREATE OR REPLACE FUNCTION public.fleet_churn_scan(p_org_ids uuid[], p_cutoff timestamptz)
RETURNS TABLE(organization_id uuid, total_leads bigint, recent_leads bigint)
LANGUAGE sql STABLE AS $function$
  SELECT
    c.organization_id,
    COUNT(*)::BIGINT AS total_leads,
    COUNT(*) FILTER (WHERE c.last_activity_at >= p_cutoff)::BIGINT AS recent_leads
  FROM public.contatos c
  WHERE c.organization_id = ANY(p_org_ids)
  GROUP BY c.organization_id;
$function$;

COMMENT ON FUNCTION public.fleet_churn_scan IS
  'Agrega em 1 query o que lib/inngest/alerts-cron.ts fazia como 2 counts por org ativa (achado 1.4 da auditoria de performance) — total de leads e leads com atividade recente, por organização, num único round-trip.';
