CREATE OR REPLACE FUNCTION create_organization_for_user(
  org_name TEXT,
  org_slug TEXT
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
  
  -- Cria org
  INSERT INTO organizations (name, slug, plan)
  VALUES (org_name, org_slug, 'starter')
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

-- Permite execução por qualquer usuário autenticado
GRANT EXECUTE ON FUNCTION create_organization_for_user(TEXT, TEXT) TO authenticated;
