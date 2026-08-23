-- financial_entries.venda_id é travado em travel_sales — vendas da tabela
-- genérica sales (usada por Agências de Tráfego e outras verticais) não
-- têm FK própria pra financeiro ainda. Mesmo padrão de FK dedicada por
-- vertical já usado (venda_id/property_deal_id/insurance_policy_id).

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS sales_generic_id UUID REFERENCES sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_entries_sales_generic ON financial_entries (sales_generic_id);

COMMENT ON COLUMN financial_entries.sales_generic_id IS
  'Vínculo com a venda genérica (sales), usado por assinaturas de plano (Agências de Tráfego) — venda_id continua exclusivo de travel_sales.';
