-- Vertical Clínicas — Fase 7: Lista de espera. Paciente quer um
-- profissional/serviço num período preferido que não tinha vaga no
-- momento. Sem disparo automático — a equipe consulta a lista e entra em
-- contato manualmente quando uma vaga abre (decisão explícita do prompt
-- original: "não fazer disparo automático sem configuração").

CREATE TABLE IF NOT EXISTS clinic_waitlist (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    patient_contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    professional_id   UUID REFERENCES clinic_professionals(id) ON DELETE SET NULL,
    event_type_id     UUID REFERENCES event_types(id) ON DELETE SET NULL,
    preferred_from    DATE,
    preferred_until   DATE,
    preferred_time    TEXT, -- texto livre: "manhã", "após 18h", etc.
    notes             TEXT,
    status            TEXT NOT NULL DEFAULT 'aguardando'
        CHECK (status IN ('aguardando', 'contatado', 'agendado', 'cancelado')),
    created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_waitlist_org ON clinic_waitlist (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinic_waitlist_professional ON clinic_waitlist (professional_id);
CREATE INDEX IF NOT EXISTS idx_clinic_waitlist_status ON clinic_waitlist (organization_id, status);

ALTER TABLE clinic_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic waitlist access" ON clinic_waitlist;
CREATE POLICY "Clinic waitlist access" ON clinic_waitlist
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic waitlist super admin" ON clinic_waitlist;
CREATE POLICY "Clinic waitlist super admin" ON clinic_waitlist
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE clinic_waitlist IS
  'Lista de espera de pacientes por profissional/serviço/período — sem disparo automático, contato manual da equipe.';
