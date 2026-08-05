-- Roteirista: gerador de roteiros de viagem via IA (Gemini Flash 2.5, com
-- busca na web), isolado das cotações — o resultado é uma tela própria de
-- consulta; "transformar em cotação" (feito na aplicação) copia os dados
-- pra uma travel_proposals nova quando o usuário quiser.

CREATE TABLE IF NOT EXISTS roteiro_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    title TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'completo' CHECK (mode IN ('completo', 'hoteis', 'voos')),

    -- Parâmetros preenchidos no formulário (não prompt livre).
    destino TEXT NOT NULL,
    data_ida DATE,
    data_volta DATE,
    periodo_flexivel BOOLEAN NOT NULL DEFAULT false,
    mes_referencia TEXT,
    pax_adults INTEGER NOT NULL DEFAULT 2,
    pax_children INTEGER NOT NULL DEFAULT 0,
    nivel_conforto TEXT,
    orcamento_cents INTEGER,
    interesses TEXT,
    observacoes TEXT,

    -- Saída da IA: um único bloco de texto rico (mesmo padrão de
    -- itinerary_html/flights_html em travel_proposals), cobrindo período
    -- sugerido, hotéis, voos e roteiro dia a dia conforme o modo escolhido.
    result_html TEXT,
    status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'done', 'error')),
    error_message TEXT,

    converted_quotation_id UUID REFERENCES travel_proposals(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roteiro_generations_org ON roteiro_generations(organization_id, created_at DESC);

ALTER TABLE roteiro_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roteiro_generations_org_access" ON roteiro_generations
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid()));

-- Base de conhecimento interna do Roteirista: fatos soltos de texto livre
-- ("Grand Palladium tem gratuidade para até 2 CHD..."), injetados no prompt
-- da IA a cada geração. Deliberadamente separada de ai_knowledge_items (essa
-- alimenta o atendente de WhatsApp, não o Roteirista).
CREATE TABLE IF NOT EXISTS roteirista_knowledge_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roteirista_knowledge_org ON roteirista_knowledge_items(organization_id);

ALTER TABLE roteirista_knowledge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roteirista_knowledge_org_access" ON roteirista_knowledge_items
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid()));
