-- Agências de Tráfego — Planos (produtos recorrentes) + extensão do motor
-- de contrato/assinatura (Autentique) pra aceitar venda genérica além de
-- travel_sales + snapshot de duração na venda.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duration_months INTEGER,
  ADD COLUMN IF NOT EXISTS contract_template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS service_start_date DATE,
  ADD COLUMN IF NOT EXISTS duration_months INTEGER;

-- sale_contracts.sale_id era NOT NULL e travado em travel_sales — passa a
-- aceitar também uma venda genérica (sales), exatamente um dos dois.
ALTER TABLE sale_contracts ALTER COLUMN sale_id DROP NOT NULL;
ALTER TABLE sale_contracts ADD COLUMN IF NOT EXISTS sales_generic_id UUID REFERENCES sales(id) ON DELETE CASCADE;

ALTER TABLE sale_contracts DROP CONSTRAINT IF EXISTS sale_contracts_exactly_one_sale;
ALTER TABLE sale_contracts ADD CONSTRAINT sale_contracts_exactly_one_sale
  CHECK ((sale_id IS NOT NULL) <> (sales_generic_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_sale_contracts_sales_generic ON sale_contracts(sales_generic_id);

COMMENT ON COLUMN products.is_recurring IS
  'Plano de assinatura mensal (Agências de Tráfego) — genérico, qualquer vertical pode usar.';
COMMENT ON COLUMN products.contract_template_id IS
  'Template de contrato (document_templates) específico deste plano/produto.';
COMMENT ON COLUMN sales.duration_months IS
  'Snapshot da duração do plano no momento da venda — não recalculado se o produto mudar depois.';
COMMENT ON COLUMN sale_contracts.sales_generic_id IS
  'Vínculo alternativo a sale_id — usado quando o contrato é de uma venda da tabela genérica sales (não travel_sales). Exatamente um dos dois é preenchido.';
