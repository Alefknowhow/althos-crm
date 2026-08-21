-- Vertical Imobiliárias — Fase 2: match lead × imóvel + visitas.
--
-- property_interests é a primeira join table de "favorito/interesse" do
-- projeto — não existe padrão equivalente pra reaproveitar, então segue a
-- mesma arquitetura RLS/índices já validada em properties.
--
-- property_visits é tabela própria (não estende o `appointments` genérico
-- usado por Agendamentos/Clínicas): esse core assume fluxo de agendamento
-- público (event_type_id obrigatório, guest_name/email/phone) que não
-- encaixa numa visita marcada pelo corretor pra um lead+imóvel
-- específicos. Confirmação/lembrete por WhatsApp reaproveita 100% o motor
-- de automação genérico (lib/inngest/automation.ts) — só os nomes de
-- evento são novos, nenhum motor.

CREATE TABLE IF NOT EXISTS property_interests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    contato_id      UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    is_favorite     BOOLEAN NOT NULL DEFAULT FALSE,
    notes           TEXT,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (property_id, contato_id)
);

CREATE INDEX IF NOT EXISTS idx_property_interests_org ON property_interests (organization_id);
CREATE INDEX IF NOT EXISTS idx_property_interests_contato ON property_interests (contato_id);
CREATE INDEX IF NOT EXISTS idx_property_interests_property ON property_interests (property_id);

ALTER TABLE property_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property interests access" ON property_interests;
CREATE POLICY "Property interests access" ON property_interests
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Property interests super admin" ON property_interests;
CREATE POLICY "Property interests super admin" ON property_interests
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE property_interests IS
  'Lead com interesse num imóvel (favorito opcional) — mostrado no detalhe do contato ("Imóveis de interesse") e no detalhe do imóvel ("Leads interessados").';

-- ── Visitas ──
CREATE TABLE IF NOT EXISTS property_visits (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    contato_id        UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    broker_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    scheduled_at      TIMESTAMPTZ NOT NULL,
    status            TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'confirmada', 'realizada', 'cancelada', 'nao_compareceu')),
    notes             TEXT,
    canceled_reason   TEXT,
    created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_visits_org ON property_visits (organization_id);
CREATE INDEX IF NOT EXISTS idx_property_visits_contato ON property_visits (contato_id);
CREATE INDEX IF NOT EXISTS idx_property_visits_property ON property_visits (property_id);
CREATE INDEX IF NOT EXISTS idx_property_visits_scheduled ON property_visits (organization_id, scheduled_at);

ALTER TABLE property_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property visits access" ON property_visits;
CREATE POLICY "Property visits access" ON property_visits
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Property visits super admin" ON property_visits;
CREATE POLICY "Property visits super admin" ON property_visits
  FOR ALL USING ((SELECT is_super_admin()));

CREATE OR REPLACE FUNCTION set_property_visit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_visit_updated_at ON property_visits;
CREATE TRIGGER trg_property_visit_updated_at
  BEFORE UPDATE ON property_visits
  FOR EACH ROW EXECUTE FUNCTION set_property_visit_updated_at();

COMMENT ON TABLE property_visits IS
  'Visita agendada de um lead a um imóvel — não estende o appointments genérico (esse assume fluxo de agendamento público, que não encaixa aqui). Confirmação/lembrete via automação genérica (eventos imoveis.visit.*).';
