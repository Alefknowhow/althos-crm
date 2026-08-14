-- Parentesco: até aqui só dava pra vincular com outro contato JÁ cadastrado
-- no CRM. Dor real de agência de viagem — a Maria (contato/cliente) viaja
-- com marido e filhos que não são leads/clientes próprios, só acompanhantes.
-- Passa a aceitar um vínculo "manual", sem contato próprio: nome, CPF e
-- nascimento direto na linha do parentesco.
ALTER TABLE public.contato_relationships
  ALTER COLUMN related_contato_id DROP NOT NULL,
  ADD COLUMN related_name TEXT,
  ADD COLUMN related_cpf TEXT,
  ADD COLUMN related_birth_date DATE,
  ADD CONSTRAINT contato_relationships_has_target
    CHECK (related_contato_id IS NOT NULL OR related_name IS NOT NULL);
