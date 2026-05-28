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
  -- Valida slug único
  IF EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) THEN
    RAISE EXCEPTION 'Já existe uma organização com esse slug';
  END IF;

  -- Buscar limites do plano
  SELECT * FROM get_plan_limits(tier_plan) INTO limits;
  
  -- Cria org
  INSERT INTO organizations (
    name, 
    slug, 
    account_type,
    plan, 
    subscription_status, 
    billing_managed_externally,
    limit_leads,
    limit_whatsapp_monthly,
    limit_email_monthly,
    limit_users,
    activated_at
  )
  VALUES (
    org_name, 
    org_slug, 
    acc_type,
    tier_plan, 
    'no_billing', 
    true,
    limits.leads,
    limits.whatsapp,
    limits.email,
    limits.users,
    NOW()
  )
  RETURNING * INTO new_org;
  
  -- Cria membership como owner
  INSERT INTO memberships (organization_id, user_id, role)
  VALUES (new_org.id, owner_id, 'owner');
  
  -- Cria pipeline default
  INSERT INTO pipelines (organization_id, name, is_default)
  VALUES (new_org.id, 'Vendas', true)
  RETURNING id INTO new_pipeline_id;
  
  -- Cria 4 stages padrão
  INSERT INTO pipeline_stages (pipeline_id, name, position, color)
  VALUES 
    (new_pipeline_id, 'Novo Lead', 1, '#94a3b8'),
    (new_pipeline_id, 'Contato Feito', 2, '#3b82f6'),
    (new_pipeline_id, 'Negociação', 3, '#eab308'),
    (new_pipeline_id, 'Fechado', 4, '#22c55e');
  
  RETURN new_org;
END;
$$;
