-- Lista de tipos de documento do contato: CPF deixa de ter frente/verso
-- (vira um item só) e ganha CNH, Passaporte e Visto — pedido de agências
-- de viagem que precisam desses documentos pra emitir passagens/vistos.
ALTER TABLE contato_documents DROP CONSTRAINT customer_documents_kind_check;

UPDATE contato_documents SET kind = 'cpf' WHERE kind IN ('cpf_front', 'cpf_back');

ALTER TABLE contato_documents
  ADD CONSTRAINT contato_documents_kind_check
  CHECK (kind = ANY (ARRAY['cpf'::text, 'rg_front'::text, 'rg_back'::text, 'cnh'::text, 'passport'::text, 'visa'::text, 'address_proof'::text, 'contract'::text, 'other'::text]));
