/*
-- Execute este script manualmente para popular dados de desenvolvimento:

INSERT INTO organizations (id, name, slug) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Althos Dev', 'althos-dev');

INSERT INTO pipelines (id, organization_id, name, is_default) 
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Vendas', true);

INSERT INTO pipeline_stages (pipeline_id, name, position) 
VALUES 
('00000000-0000-0000-0000-000000000002', 'Novo Lead', 1),
('00000000-0000-0000-0000-000000000002', 'Contato Feito', 2),
('00000000-0000-0000-0000-000000000002', 'Negociação', 3),
('00000000-0000-0000-0000-000000000002', 'Fechado', 4);

-- Lembre-se de criar o usuário manualmente via Dashboard ou API e criar uma membership para o '00000000-0000-0000-0000-000000000001'
*/
