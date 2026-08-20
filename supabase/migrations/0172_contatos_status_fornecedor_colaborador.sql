-- Adiciona 'fornecedor' e 'colaborador' à classificação de contatos
-- (contatos.status), ao lado de lead/cliente/inativo já existentes.
ALTER TABLE public.contatos DROP CONSTRAINT contatos_status_check;
ALTER TABLE public.contatos
  ADD CONSTRAINT contatos_status_check
  CHECK (status IN ('lead', 'cliente', 'inativo', 'fornecedor', 'colaborador'));
