-- Fecha o gap identificado: atendimento concluído já virava registro de
-- Atendimento + comissão automática, mas nunca lançava a receita em
-- Financeiro (só o Pacote fazia isso). Agora clinic_attendances carrega o
-- valor cobrado do paciente e se liga a um financial_entries, no mesmo
-- padrão que clinic_packages.financial_entry_id já usa.
ALTER TABLE clinic_attendances
  ADD COLUMN IF NOT EXISTS total_cents INTEGER,
  ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS financial_entry_id UUID REFERENCES financial_entries(id) ON DELETE SET NULL;

COMMENT ON COLUMN clinic_attendances.total_cents IS
  'Valor cobrado do paciente pelo procedimento — default = clinic_service_context.price_cents no momento da conclusão, editável depois.';
COMMENT ON COLUMN clinic_attendances.discount_cents IS
  'Desconto aplicado sobre total_cents (ex.: cupom do tipo de evento). Receita lançada em financial_entries = total_cents - discount_cents.';
COMMENT ON COLUMN clinic_attendances.financial_entry_id IS
  'Lançamento em financial_entries (receita) gerado automaticamente ao concluir o atendimento, quando total_cents > 0.';
