-- Consolida o "contexto do negócio" da IA num único lugar.
--
-- Hoje existem dois campos paralelos e desincronizados:
--   - organizations.ai_business_context  (lido em produção pelo motor do
--     Instagram e pelo qualificador de lead — lib/social/engine.ts,
--     lib/social/funnel-engine.ts, lib/ai/run-qualification.ts)
--   - ai_attendant_config.business_context (editado na tela "Agente IA",
--     mas nunca lido em produção até agora — só no sandbox de teste)
--
-- organizations.ai_business_context vira a fonte única de verdade. Quem
-- preencheu o campo em "Agente IA" (achando que valia pra automação real)
-- não pode perder esse texto: faz backfill pra organizations quando esta
-- estiver vazia. Não apaga a coluna antiga do ai_attendant_config — só para
-- de ser lida pelo app (actions/ai_attendant.ts passa a ler/escrever em
-- organizations a partir de agora).
UPDATE organizations o
SET ai_business_context = a.business_context
FROM ai_attendant_config a
WHERE a.organization_id = o.id
  AND COALESCE(NULLIF(TRIM(a.business_context), ''), '') <> ''
  AND COALESCE(NULLIF(TRIM(o.ai_business_context), ''), '') = '';

-- Mesma lógica pro modelo: ai_attendant_config.model vira redundante com
-- organizations.ai_qualifier_model (já compartilhado pelo Instagram e pelo
-- qualificador). Só faz backfill se o org ainda não tiver escolhido nada
-- (o default 'claude-haiku-4-5' de ambos os lados não conta como escolha).
UPDATE organizations o
SET ai_qualifier_model = a.model
FROM ai_attendant_config a
WHERE a.organization_id = o.id
  AND a.model IS NOT NULL AND a.model <> '' AND a.model <> 'claude-haiku-4-5'
  AND (o.ai_qualifier_model IS NULL OR o.ai_qualifier_model = '' OR o.ai_qualifier_model = 'claude-haiku-4-5');
