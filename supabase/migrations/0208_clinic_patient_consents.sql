-- Item 4 da recomendação da auditoria LGPD (docs/audit/clinicas-lgpd.md):
-- consentimento específico pra tratamento de dado de saúde (LGPD art. 11 —
-- categoria especial exige consentimento específico e destacado, diferente
-- do consentimento genérico de uso da plataforma que o paciente nunca dá,
-- só a organização/usuário do CRM). Um registro por manifestação de
-- consentimento (histórico completo, nunca sobrescrito) — "ativo" = o mais
-- recente sem revoked_at.
CREATE TABLE IF NOT EXISTS clinic_patient_consents (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    patient_contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    consent_type      TEXT NOT NULL DEFAULT 'dados_saude',
    method            TEXT NOT NULL DEFAULT 'verbal' CHECK (method IN ('verbal', 'termo_assinado', 'digital')),
    given_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    given_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes             TEXT,
    revoked_at        TIMESTAMPTZ,
    revoked_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_patient_consents_patient ON clinic_patient_consents (patient_contato_id, given_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinic_patient_consents_org ON clinic_patient_consents (organization_id);

ALTER TABLE clinic_patient_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic patient consents access" ON clinic_patient_consents;
CREATE POLICY "Clinic patient consents access" ON clinic_patient_consents
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Clinic patient consents super admin" ON clinic_patient_consents;
CREATE POLICY "Clinic patient consents super admin" ON clinic_patient_consents
  FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE clinic_patient_consents IS
  'Consentimento específico do paciente pra tratamento de dado de saúde (LGPD art. 11), distinto do consentimento genérico de uso da plataforma. Histórico completo — "ativo" = registro mais recente sem revoked_at.';
