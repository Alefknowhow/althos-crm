-- Prontuário (Vertical Clínicas) — MÓDULO CRIADO OCULTO DE PROPÓSITO.
-- Ver docs/audit/clinicas-lgpd.md: dado de saúde estruturado (diagnóstico,
-- avaliação clínica, plano de tratamento) é categoria especial pela LGPD e
-- a própria auditoria recomenda um log de acesso em nível de aplicação
-- ANTES de expor esse tipo de campo. Este módulo fica com visibilidade
-- forçada em false em lib/niche-modules.ts até uma decisão explícita.
--
-- Separado de clinic_attendances (que é operacional/comercial, nunca
-- clínico, por design) — 1 paciente tem N evoluções, cada uma
-- opcionalmente ligada ao atendimento que a originou.
CREATE TABLE IF NOT EXISTS clinic_medical_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    patient_contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    professional_id   UUID REFERENCES clinic_professionals(id) ON DELETE SET NULL,
    attendance_id     UUID REFERENCES clinic_attendances(id) ON DELETE SET NULL,
    entry_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Formato SOAP (Subjetivo/Objetivo/Avaliação/Plano) — padrão de
    -- evolução clínica usado pelas plataformas do mercado (iClinic,
    -- Feegow). Todos nullable: cada evolução usa só os campos que fizerem
    -- sentido pro caso.
    subjective        TEXT,
    objective         TEXT,
    assessment        TEXT,
    plan              TEXT,
    created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_medical_records_org ON clinic_medical_records (organization_id);
CREATE INDEX IF NOT EXISTS idx_clinic_medical_records_patient ON clinic_medical_records (patient_contato_id, entry_date DESC);

ALTER TABLE clinic_medical_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic medical records access" ON clinic_medical_records;
CREATE POLICY "Clinic medical records access" ON clinic_medical_records
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic medical records super admin" ON clinic_medical_records;
CREATE POLICY "Clinic medical records super admin" ON clinic_medical_records
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE clinic_medical_records IS
  'Prontuário — evoluções clínicas (SOAP) por paciente. Dado de saúde sensível (LGPD categoria especial). Módulo oculto até decisão de compliance — ver docs/audit/clinicas-lgpd.md.';

-- Item 1 da recomendação da auditoria LGPD: log de acesso em nível de
-- aplicação (quem viu/criou/editou/apagou o quê, de qual paciente).
-- Escrito pelas actions de clinic-medical-records.ts a cada operação.
CREATE TABLE IF NOT EXISTS clinic_data_access_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action            TEXT NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete')),
    patient_contato_id UUID REFERENCES contatos(id) ON DELETE SET NULL,
    record_id         UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_data_access_log_org ON clinic_data_access_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinic_data_access_log_patient ON clinic_data_access_log (patient_contato_id);

ALTER TABLE clinic_data_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic data access log access" ON clinic_data_access_log;
CREATE POLICY "Clinic data access log access" ON clinic_data_access_log
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic data access log super admin" ON clinic_data_access_log;
CREATE POLICY "Clinic data access log super admin" ON clinic_data_access_log
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE clinic_data_access_log IS
  'Trilha de auditoria de acesso a dado clínico sensível (Prontuário) — quem viu/criou/editou/apagou o quê, de qual paciente. Pré-requisito de compliance identificado em docs/audit/clinicas-lgpd.md §4 item 1.';
