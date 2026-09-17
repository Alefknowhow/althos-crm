-- Correção de modelo: o contrato de plano (Agências de Tráfego) é uma
-- relação Agência↔Cliente, firmada assim que o contato vira cliente — não
-- tem relação com vendas específicas. sale_id vira opcional (linhas
-- antigas continuam existindo), contato_id passa a ser a chave real.
ALTER TABLE plan_contracts ADD COLUMN IF NOT EXISTS contato_id UUID REFERENCES contatos(id) ON DELETE CASCADE;
ALTER TABLE plan_contracts ALTER COLUMN sale_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plan_contracts_contato ON plan_contracts(contato_id);

-- Backfill best-effort das linhas existentes (uma venda sempre aponta pra
-- um contato) — preserva contratos já criados antes desta correção.
UPDATE plan_contracts pc
SET contato_id = s.contato_id
FROM sales s
WHERE pc.sale_id = s.id AND pc.contato_id IS NULL;

COMMENT ON COLUMN plan_contracts.contato_id IS
  'Cliente da agência (Agência↔Cliente) — chave real do contrato, criado assim que o contato vira cliente. sale_id é legado, mantido só pra registros antigos.';
