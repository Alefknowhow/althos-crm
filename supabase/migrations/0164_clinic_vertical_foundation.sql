-- Vertical Clínicas — Fase 1 (fundação): catálogo (especialidades,
-- profissionais, salas) + contexto clínico sobre Agendamentos Core
-- (event_types → serviço; appointments → agendamento). Não duplica Core:
-- paciente = contatos (via appointments.lead_id, já existente), serviço =
-- event_types (contexto extra numa tabela própria, não novas colunas no
-- Core), agenda = appointments (idem).

-- ── Especialidades ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_specialties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_specialties_org ON clinic_specialties (organization_id);

-- ── Profissionais ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_professionals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    specialty_id    UUID REFERENCES clinic_specialties(id) ON DELETE SET NULL,
    -- Vínculo opcional com um usuário do CRM (pra permissões futuras tipo
    -- "profissional só vê os próprios atendimentos") — nunca obrigatório,
    -- muitas clínicas cadastram profissional sem ele ter login no sistema.
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    registration_no TEXT,
    commission_pct  NUMERIC(5,2),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_professionals_org ON clinic_professionals (organization_id);

-- ── Salas / recursos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_rooms_org ON clinic_rooms (organization_id);

-- ── Contexto clínico do serviço (event_types) ───────────────────────────────
-- 1:1 com event_types — extensão vertical, sem tocar a tabela Core.
CREATE TABLE IF NOT EXISTS clinic_service_context (
    event_type_id   UUID PRIMARY KEY REFERENCES event_types(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    specialty_id    UUID REFERENCES clinic_specialties(id) ON DELETE SET NULL,
    price_cents     INTEGER,
    room_id         UUID REFERENCES clinic_rooms(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_clinic_service_context_org ON clinic_service_context (organization_id);

-- ── Contexto clínico do agendamento (appointments) ──────────────────────────
-- 1:1 com appointments. Paciente já é appointments.lead_id (contatos) — não
-- duplicado aqui. clinic_status é a máquina de estados operacional da
-- clínica; appointments.status (Core, só scheduled/canceled/completed)
-- continua existindo e sincronizado de forma simples pelas actions (nunca
-- alterado o CHECK constraint do Core, pra não arriscar o agendamento
-- genérico de outros nichos).
CREATE TABLE IF NOT EXISTS clinic_appointment_context (
    appointment_id  UUID PRIMARY KEY REFERENCES appointments(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES clinic_professionals(id) ON DELETE SET NULL,
    room_id         UUID REFERENCES clinic_rooms(id) ON DELETE SET NULL,
    clinic_status   TEXT NOT NULL DEFAULT 'agendado'
        CHECK (clinic_status IN (
            'aguardando_confirmacao', 'agendado', 'confirmado', 'em_atendimento',
            'realizado', 'cancelado', 'reagendado', 'no_show'
        )),
    confirmed_at    TIMESTAMPTZ,
    no_show_at      TIMESTAMPTZ,
    reminder_sent_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_appointment_context_org ON clinic_appointment_context (organization_id);

-- ── RLS — mesmo padrão do resto do projeto (isolamento por org + super admin) ──
ALTER TABLE clinic_specialties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_professionals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_rooms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_service_context     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_appointment_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic specialties access" ON clinic_specialties;
CREATE POLICY "Clinic specialties access" ON clinic_specialties
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic specialties super admin" ON clinic_specialties;
CREATE POLICY "Clinic specialties super admin" ON clinic_specialties
  FOR ALL USING ((SELECT is_super_admin()));

DROP POLICY IF EXISTS "Clinic professionals access" ON clinic_professionals;
CREATE POLICY "Clinic professionals access" ON clinic_professionals
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic professionals super admin" ON clinic_professionals;
CREATE POLICY "Clinic professionals super admin" ON clinic_professionals
  FOR ALL USING ((SELECT is_super_admin()));

DROP POLICY IF EXISTS "Clinic rooms access" ON clinic_rooms;
CREATE POLICY "Clinic rooms access" ON clinic_rooms
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic rooms super admin" ON clinic_rooms;
CREATE POLICY "Clinic rooms super admin" ON clinic_rooms
  FOR ALL USING ((SELECT is_super_admin()));

DROP POLICY IF EXISTS "Clinic service context access" ON clinic_service_context;
CREATE POLICY "Clinic service context access" ON clinic_service_context
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic service context super admin" ON clinic_service_context;
CREATE POLICY "Clinic service context super admin" ON clinic_service_context
  FOR ALL USING ((SELECT is_super_admin()));

DROP POLICY IF EXISTS "Clinic appointment context access" ON clinic_appointment_context;
CREATE POLICY "Clinic appointment context access" ON clinic_appointment_context
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic appointment context super admin" ON clinic_appointment_context;
CREATE POLICY "Clinic appointment context super admin" ON clinic_appointment_context
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE clinic_appointment_context IS
  'Contexto clínico 1:1 sobre appointments (Core) — profissional, sala e status operacional detalhado. Paciente = appointments.lead_id (contatos), não duplicado aqui.';
COMMENT ON TABLE clinic_service_context IS
  'Contexto clínico 1:1 sobre event_types (Core, = "serviço" da clínica) — especialidade, preço, sala padrão.';
