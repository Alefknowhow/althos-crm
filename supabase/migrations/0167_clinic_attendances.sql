-- Vertical Clínicas — Fase 5: Atendimentos. Registro operacional do que
-- aconteceu num atendimento — deliberadamente NÃO é prontuário médico
-- (seção 15/16 do prompt): sem diagnóstico, sem prescrição, sem dado
-- clínico sensível. Só campos comerciais/operacionais (observações,
-- recomendações, sugestão de retorno). Uma auditoria LGPD dedicada é
-- pré-requisito antes de qualquer campo de dado de saúde sensível ser
-- adicionado no futuro.

CREATE TABLE IF NOT EXISTS clinic_attendances (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    appointment_id    UUID REFERENCES appointments(id) ON DELETE SET NULL,
    patient_contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    professional_id   UUID REFERENCES clinic_professionals(id) ON DELETE SET NULL,
    event_type_id     UUID REFERENCES event_types(id) ON DELETE SET NULL,
    attended_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes             TEXT,
    recommendations   TEXT,
    next_return_date  DATE,
    created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_attendances_org ON clinic_attendances (organization_id, attended_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinic_attendances_patient ON clinic_attendances (patient_contato_id);
-- Evita duplicar o atendimento automático quando um agendamento vira
-- "realizado" mais de uma vez (reabrir/fechar de novo).
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_attendances_appointment ON clinic_attendances (appointment_id) WHERE appointment_id IS NOT NULL;

ALTER TABLE clinic_attendances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic attendances access" ON clinic_attendances;
CREATE POLICY "Clinic attendances access" ON clinic_attendances
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic attendances super admin" ON clinic_attendances;
CREATE POLICY "Clinic attendances super admin" ON clinic_attendances
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE clinic_attendances IS
  'Registro operacional de atendimento (Clínicas) — não é prontuário médico. Sem diagnóstico/prescrição/dado clínico sensível por design.';
