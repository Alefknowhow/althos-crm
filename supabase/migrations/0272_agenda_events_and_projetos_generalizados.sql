-- Issue #14 — módulo Agenda (Tarefas · Calendário · Projetos).
--
-- 1) Nova tabela `events`: compromissos/eventos da Agenda → Calendário.
--    Conceito distinto de Task (ação a executar) e de `appointments`
--    (booking público estilo Calendly, usado por Clínicas) — um Event é um
--    compromisso que ocupa um intervalo de tempo, sem virar Task nem
--    reservar um slot de agendamento público. Campos de integração externa
--    (meeting_provider/external_event_id/...) são só preparação de schema
--    para sync futuro (Google/Outlook) — não implementado nesta entrega.
--
-- 2) Generaliza `projetos`: Agenda → Projetos deixa de ser exclusivo do
--    nicho Agências de Tráfego, então um projeto passa a poder existir sem
--    cliente vinculado ("uso interno").

CREATE TABLE IF NOT EXISTS events (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title                TEXT NOT NULL,
    description          TEXT,
    notes                TEXT,
    start_at             TIMESTAMPTZ NOT NULL,
    end_at               TIMESTAMPTZ NOT NULL,
    all_day              BOOLEAN NOT NULL DEFAULT false,
    organizer_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    participant_ids      UUID[] NOT NULL DEFAULT '{}',
    contato_id           UUID REFERENCES contatos(id) ON DELETE SET NULL,
    -- Mesmo par genérico "Relacionado a" de tasks.related_entity_* — sem FK
    -- real possível contra tabelas heterogêneas (ver 0217_tasks_related_entity_and_completed_at.sql).
    related_entity_type  TEXT CHECK (related_entity_type IN ('travel_proposal','appointment','sale','property_deal','property_proposal')),
    related_entity_id    UUID,
    location             TEXT,
    event_type           TEXT NOT NULL DEFAULT 'presencial' CHECK (event_type IN ('presencial','google_meet','zoom','teams','ligacao','outro')),
    status               TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','canceled')),
    color                TEXT,
    -- Preparação para sync bidirecional futura (issue #14 §8) — nenhum
    -- destes campos é lido/escrito por código nesta entrega.
    meeting_provider     TEXT,
    external_event_id    TEXT,
    external_calendar_id TEXT,
    meeting_url          TEXT,
    external_meeting_id  TEXT,
    sync_status          TEXT,
    created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_events_org ON events (organization_id);
CREATE INDEX IF NOT EXISTS idx_events_org_range ON events (organization_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_events_contato ON events (organization_id, contato_id) WHERE contato_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_related_entity ON events (related_entity_type, related_entity_id) WHERE related_entity_type IS NOT NULL;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events access" ON events
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Events super admin" ON events
  FOR ALL USING ((SELECT is_super_admin()));

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_traffic_updated_at();

COMMENT ON TABLE events IS
  'Agenda → Calendário: compromissos/eventos que ocupam um intervalo de tempo. Distinto de Task (ação a executar) e de appointments (booking público). Campos meeting_provider/external_*/sync_status são preparação para sync externo futuro, ainda não implementada.';

-- Generaliza Projetos: deixa de exigir cliente (Agenda → Projetos vale para
-- qualquer nicho, inclusive projetos internos sem contato vinculado).
ALTER TABLE projetos ALTER COLUMN client_id DROP NOT NULL;

COMMENT ON COLUMN projetos.client_id IS 'Cliente/contato dono do projeto. NULL para projetos de uso interno (Agenda → Projetos generalizada, issue #14).';
