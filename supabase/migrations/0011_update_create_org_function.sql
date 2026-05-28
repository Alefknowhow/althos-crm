CREATE OR REPLACE FUNCTION create_organization_for_user(
  org_name TEXT,
  org_slug TEXT,
  acc_type TEXT DEFAULT 'self_signup'
)
RETURNS organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org organizations;
  new_pipeline_id UUID;
  current_user_id UUID;
  initial_plan TEXT;
  initial_status TEXT;
  trial_end TIMESTAMPTZ := NULL;
  ext_billing BOOLEAN := false;
  limits RECORD;
BEGIN
  -- Pega o user logado
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Valida slug único
  IF EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) THEN
    RAISE EXCEPTION 'Já existe uma organização com esse slug';
  END IF;

  -- Definir valores iniciais baseado no account_type
  IF acc_type = 'althos_managed' THEN
    initial_plan := 'althos_starter';
    initial_status := 'no_billing';
    ext_billing := true;
  ELSIF acc_type = 'internal' THEN
    initial_plan := 'internal';
    initial_status := 'no_billing';
  ELSE
    initial_plan := 'free_trial';
    initial_status := 'trialing';
    trial_end := NOW() + INTERVAL '7 days';
  END IF;

  -- Buscar limites do plano
  SELECT * FROM get_plan_limits(initial_plan) INTO limits;
  
  -- Cria org
  INSERT INTO organizations (
    name, 
    slug, 
    account_type,
    plan, 
    subscription_status, 
    trial_ends_at, 
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
    initial_plan, 
    initial_status, 
    trial_end, 
    ext_billing,
    limits.leads,
    limits.whatsapp,
    limits.email,
    limits.users,
    CASE WHEN acc_type = 'althos_managed' THEN NOW() ELSE NULL END
  )
  RETURNING * INTO new_org;
  
  -- Cria membership como owner
  INSERT INTO memberships (organization_id, user_id, role)
  VALUES (new_org.id, current_user_id, 'owner');
  
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

-- Grant execute on new signature
GRANT EXECUTE ON FUNCTION create_organization_for_user(TEXT, TEXT, TEXT) TO authenticated;
