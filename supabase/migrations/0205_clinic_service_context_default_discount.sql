-- Cupom/desconto padrão do procedimento (event_type) — como procedimentos e
-- pacotes têm preço fixo, o único ajuste comercial real é um desconto
-- pontual. Guardado no procedimento em vez de precisar de um módulo de
-- Orçamentos à parte.
ALTER TABLE clinic_service_context
  ADD COLUMN IF NOT EXISTS default_discount_cents INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN clinic_service_context.default_discount_cents IS
  'Desconto padrão aplicado ao concluir um atendimento desse procedimento — pré-preenche clinic_attendances.discount_cents, editável por atendimento.';
