-- Motor de precificação de créditos de IA: catálogo de custo real por ação
-- (tokens médios × preço do modelo) + configurações de margem/câmbio usadas
-- pra calcular quanto vale 1 crédito em R$. `credits_cost` é a coluna AO VIVO
-- lida em runtime por consumeAiCredits() (lib/plans/server.ts) — editar aqui
-- muda a cobrança imediatamente, sem deploy. `recommended_credits_cost` é só
-- informativo (o que o custo real sugere, ancorado em ai_attendant_reply).

CREATE TABLE IF NOT EXISTS ai_action_cost_catalog (
    action_key              TEXT PRIMARY KEY,
    label                   TEXT NOT NULL,
    typical_provider        TEXT NOT NULL DEFAULT 'anthropic' CHECK (typical_provider IN ('anthropic','gemini')),
    typical_model           TEXT NOT NULL,
    avg_input_tokens        INTEGER NOT NULL DEFAULT 0,
    avg_output_tokens       INTEGER NOT NULL DEFAULT 0,
    avg_cost_usd_cents      NUMERIC(10,5) NOT NULL DEFAULT 0,
    credits_cost            INTEGER NOT NULL DEFAULT 1, -- AO VIVO — lido por consumeAiCredits()
    recommended_credits_cost INTEGER,                    -- informativo, derivado do custo real
    notes                   TEXT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON ai_action_cost_catalog;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_action_cost_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS ai_credit_pricing_settings (
    id                      SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    usd_to_brl_rate         NUMERIC(10,4) NOT NULL DEFAULT 5.40,
    margin_pct              NUMERIC(5,2) NOT NULL DEFAULT 25,
    anchor_action_key       TEXT NOT NULL DEFAULT 'ai_attendant_reply' REFERENCES ai_action_cost_catalog(action_key),
    credit_cost_usd_cents   NUMERIC(10,5),  -- custo (USD¢) de 1 crédito = anchor.avg_cost_usd_cents / anchor.credits_cost
    credit_cost_brl_cents   NUMERIC(10,5),  -- custo em BRL¢
    credit_price_brl_cents  NUMERIC(10,5),  -- preço de venda em BRL¢ = custo × (1 + margin_pct/100)
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON ai_credit_pricing_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_credit_pricing_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: catálogo de custo é lido em runtime por QUALQUER conta autenticada
-- (consumeAiCredits roda no contexto da sessão do usuário) — leitura liberada,
-- escrita só super-admin. Settings de precificação são estritamente internas
-- (só super-admin, nem leitura pública).
ALTER TABLE ai_action_cost_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read ai action cost catalog" ON ai_action_cost_catalog;
CREATE POLICY "read ai action cost catalog" ON ai_action_cost_catalog FOR SELECT USING (true);
DROP POLICY IF EXISTS "super admin manage ai action cost catalog" ON ai_action_cost_catalog;
CREATE POLICY "super admin manage ai action cost catalog" ON ai_action_cost_catalog
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE ai_credit_pricing_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super admin manage ai credit pricing settings" ON ai_credit_pricing_settings;
CREATE POLICY "super admin manage ai credit pricing settings" ON ai_credit_pricing_settings
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ── Seed: custo real estimado por ação (tokens médios × pricing do modelo,
-- mesma tabela de USD/1M tokens usada em lib/ai/attendant-engine.ts). São
-- estimativas editáveis — ponto de partida grounded em pricing real, não
-- medição exata por enquanto (não há telemetria de tokens persistida ainda).
-- credits_cost = valor JÁ COBRADO hoje (AI_CREDIT_COST em lib/plans/config.ts)
-- — inalterado nesta migration, só o cálculo de custo real é novo.
INSERT INTO ai_action_cost_catalog (action_key, label, typical_provider, typical_model, avg_input_tokens, avg_output_tokens, avg_cost_usd_cents, credits_cost, recommended_credits_cost, notes) VALUES
  ('ai_attendant_reply', 'Resposta automática — WhatsApp', 'anthropic', 'claude-haiku-4-5', 1500, 150, 0.225, 1, 1, 'Âncora do sistema: 1 crédito = custo desta ação. Inclui histórico de conversa + base de conhecimento no contexto.'),
  ('instagram_ai_reply', 'Resposta automática — Instagram', 'anthropic', 'claude-haiku-4-5', 800, 100, 0.13, 1, 1, 'Contexto menor que o WhatsApp (sem histórico longo de conversa).'),
  ('ai_insights_query', 'Copiloto IA (dashboard)', 'anthropic', 'claude-sonnet-4-6', 4000, 500, 1.95, 2, 9, 'Modelo Sonnet é ~9x mais caro que Haiku — custo real está bem acima do que é cobrado hoje (2 créditos). Revisar.'),
  ('financial_ai_chat', 'Copiloto Financeiro (chat)', 'anthropic', 'claude-sonnet-4-6', 3000, 400, 1.5, 2, 7, 'Mesmo modelo do Copiloto de insights — mesma discrepância entre custo real e cobrança atual.'),
  ('ocr_extract', 'OCR de documento (voucher/voo/cruzeiro)', 'anthropic', 'claude-sonnet-4-6', 2000, 300, 1.05, 3, 5, 'Leitura de imagem/PDF via visão — assume Sonnet pela precisão exigida em dados financeiros.'),
  ('roteirista_generate', 'Geração de roteiro de viagem', 'gemini', 'gemini-3.5-flash', 5000, 2000, 0.13, 4, 1, 'Gemini Flash é muito mais barato por token que Sonnet — mas usa web search/grounding cuja taxa não está no cálculo de tokens abaixo; cobrança atual (4 créditos) provavelmente já compensa isso.'),
  ('lead_scoring', 'Qualificação de lead (IA)', 'gemini', 'gemini-3.6-flash', 1200, 150, 0.018, 1, 1, 'Classificação curta, custo real desprezível — 1 crédito já é o mínimo cobrável.'),
  ('qualify_lead', 'Qualificação de lead (variante)', 'gemini', 'gemini-3.6-flash', 1200, 150, 0.018, 1, 1, 'Mesma ação de lead_scoring — sem call site próprio hoje, mantido por compatibilidade.'),
  ('generate_proposal', 'Geração de proposta/orçamento', 'anthropic', 'claude-sonnet-4-6', 2000, 800, 1.8, 3, 8, 'Sem call site ativo hoje — estimativa preparatória.'),
  ('property_matching', 'Match de imóveis (Imobiliárias)', 'anthropic', 'claude-haiku-4-5', 1000, 200, 0.2, 1, 1, 'Custo baixo, comparável a uma resposta de atendente.')
ON CONFLICT (action_key) DO NOTHING;

-- ── Seed: configurações de precificação (câmbio + margem de 25%) ──
INSERT INTO ai_credit_pricing_settings (id, usd_to_brl_rate, margin_pct, anchor_action_key)
VALUES (1, 5.40, 25, 'ai_attendant_reply')
ON CONFLICT (id) DO NOTHING;

-- Calcula o custo/preço do crédito a partir da âncora (attendant reply):
-- custo USD¢ por crédito = custo da ação-âncora / créditos cobrados por ela.
UPDATE ai_credit_pricing_settings s
SET
  credit_cost_usd_cents  = a.avg_cost_usd_cents / GREATEST(a.credits_cost, 1),
  credit_cost_brl_cents  = (a.avg_cost_usd_cents / GREATEST(a.credits_cost, 1)) * s.usd_to_brl_rate,
  credit_price_brl_cents = (a.avg_cost_usd_cents / GREATEST(a.credits_cost, 1)) * s.usd_to_brl_rate * (1 + s.margin_pct / 100)
FROM ai_action_cost_catalog a
WHERE a.action_key = s.anchor_action_key AND s.id = 1;

COMMENT ON TABLE ai_action_cost_catalog IS 'Custo real estimado (tokens × pricing do modelo) por ação de IA do CRM — credits_cost é a cobrança AO VIVO lida por consumeAiCredits().';
COMMENT ON TABLE ai_credit_pricing_settings IS 'Configuração global de precificação do crédito de IA (câmbio, margem, ação-âncora) — usado pela calculadora do super-admin.';
