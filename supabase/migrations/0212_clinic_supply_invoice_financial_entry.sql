-- Vincula cada NF de insumos a um lançamento de despesa em Financeiro
-- (criado automaticamente ao confirmar a NF) — mesmo padrão de
-- clinic_attendances.financial_entry_id.
ALTER TABLE clinic_supply_invoices
  ADD COLUMN IF NOT EXISTS financial_entry_id UUID REFERENCES financial_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_supply_invoices_financial_entry ON clinic_supply_invoices (financial_entry_id);

COMMENT ON COLUMN clinic_supply_invoices.financial_entry_id IS 'Lançamento de despesa (Financeiro) gerado automaticamente ao confirmar a NF.';
