-- Agrega em 1 query o que actions/super-admin-orgs.ts::getAllOrganizations e
-- actions/super-admin-accounts.ts::getPlatformAccounts faziam como N queries
-- de count por org (achados 1.2/1.3 da auditoria de performance) — 400
-- requests concorrentes ao Postgrest numa frota de 200 orgs, por exemplo.

CREATE OR REPLACE FUNCTION public.fleet_lead_and_member_counts(p_org_ids uuid[])
RETURNS TABLE(organization_id uuid, lead_count bigint, member_count bigint)
LANGUAGE sql STABLE AS $function$
  SELECT
    o.id AS organization_id,
    COALESCE(c.cnt, 0)::BIGINT AS lead_count,
    COALESCE(m.cnt, 0)::BIGINT AS member_count
  FROM unnest(p_org_ids) AS o(id)
  LEFT JOIN (SELECT organization_id, COUNT(*) AS cnt FROM public.contatos WHERE organization_id = ANY(p_org_ids) GROUP BY organization_id) c ON c.organization_id = o.id
  LEFT JOIN (SELECT organization_id, COUNT(*) AS cnt FROM public.memberships WHERE organization_id = ANY(p_org_ids) GROUP BY organization_id) m ON m.organization_id = o.id;
$function$;

COMMENT ON FUNCTION public.fleet_lead_and_member_counts IS
  'Agrega em 1 query o que actions/super-admin-orgs.ts::getAllOrganizations e actions/super-admin-accounts.ts::getPlatformAccounts faziam como N queries de count por org.';
