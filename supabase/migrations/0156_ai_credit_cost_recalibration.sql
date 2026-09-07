-- Correção de custo real dos créditos de IA + volume ajustado pra 10% do
-- valor do plano (era 5% na migration 0155).
--
-- A âncora do sistema (ai_attendant_reply) estava calculada por estimativa
-- de tokens (1500 entrada / 150 saída, Haiku) = US$0,00225/resposta —
-- quase 4,5x abaixo do custo real observado em produção (~US$0,01/resposta,
-- provavelmente por causa de iterações de tool-use — consulta de
-- disponibilidade — e contexto maior que o assumido).
--
-- Isso invalidava a distribuição de créditos da migration 0155 (calculada
-- em cima do custo errado): os 700/1650/2900 créditos por plano
-- representavam, na prática, ~4,4x o orçamento de 5% pretendido.

update ai_action_cost_catalog
set avg_cost_usd_cents = 1.0,
    recommended_credits_cost = 1,
    notes = 'Recalibrado com custo real observado em produção (~US$0,01/resposta) em vez da estimativa por tokens (1500in/150out) — a estimativa não capturava iterações de tool-use (consulta de agenda) nem contexto maior que o assumido.'
where action_key = 'ai_attendant_reply';

update ai_credit_pricing_settings
set credit_cost_usd_cents = 1.0,
    credit_cost_brl_cents = 1.0 * usd_to_brl_rate,
    credit_price_brl_cents = (1.0 * usd_to_brl_rate) * (1 + margin_pct/100)
where id = 1;

-- Créditos mensais recalculados: 10% do valor do plano ÷ R$0,054/crédito
-- (custo real corrigido, câmbio R$5,40).
update plans set ai_credits_monthly = 310  where id = 'starter';  -- era 700 (5% com custo errado)
update plans set ai_credits_monthly = 740  where id = 'pro';      -- era 1650
update plans set ai_credits_monthly = 1290 where id = 'business'; -- era 2900
