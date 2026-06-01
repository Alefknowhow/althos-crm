-- Travel sales weren't being auto-generated on "Fechado" because the default
-- seeded "Fechado" stage was never flagged is_won. Fix the seed function and
-- backfill existing default stages.

-- 1) Seed function: flag "Fechado" as a won stage for new orgs.
CREATE OR REPLACE FUNCTION create_organization_for_user_manual(
  org_name TEXT,
  org_slug TEXT,
  owner_id UUID,
  acc_type TEXT,
  tier_plan TEXT
)
RETURNS organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org organizations;
  new_pipeline_id UUID;
  limits RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) THEN
    RAISE EXCEPTION 'Já existe uma organização com esse slug';
  END IF;

  SELECT * FROM get_plan_limits(tier_plan) INTO limits;

  INSERT INTO organizations (
    name, slug, account_type, plan, subscription_status,
    billing_managed_externally, limit_leads, limit_whatsapp_monthly,
    limit_email_monthly, limit_users, activated_at
  )
  VALUES (
    org_name, org_slug, acc_type, tier_plan, 'no_billing', true,
    limits.leads, limits.whatsapp, limits.email, limits.users, NOW()
  )
  RETURNING * INTO new_org;

  INSERT INTO memberships (organization_id, user_id, role)
  VALUES (new_org.id, owner_id, 'owner');

  INSERT INTO pipelines (organization_id, name, is_default)
  VALUES (new_org.id, 'Vendas', true)
  RETURNING id INTO new_pipeline_id;

  INSERT INTO pipeline_stages (pipeline_id, name, position, color, is_won)
  VALUES
    (new_pipeline_id, 'Novo Lead', 1, '#94a3b8', false),
    (new_pipeline_id, 'Contato Feito', 2, '#3b82f6', false),
    (new_pipeline_id, 'Negociação', 3, '#eab308', false),
    (new_pipeline_id, 'Fechado', 4, '#22c55e', true);

  RETURN new_org;
END;
$$;

-- 2) Backfill existing default "Fechado" stages that were never flagged won.
UPDATE pipeline_stages
SET is_won = true
WHERE name = 'Fechado' AND is_won = false AND is_lost = false;
