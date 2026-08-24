-- Conteúdo do contrato editável POR VENDA (não só o modelo global do
-- Plano) — cada contrato de assinatura de tráfego pode ter cláusulas
-- diferentes, então o operador precisa poder ajustar o texto antes de
-- gerar o PDF ou antes de mandar pra assinatura, sem alterar o modelo
-- padrão usado pelos outros contratos.

ALTER TABLE plan_contracts ADD COLUMN IF NOT EXISTS body_html TEXT;

COMMENT ON COLUMN plan_contracts.body_html IS
  'Conteúdo HTML editado manualmente pra este contrato específico — sobrepõe o modelo do produto (contract_template_id) ao gerar o PDF. NULL = usa o modelo/fallback padrão.';
