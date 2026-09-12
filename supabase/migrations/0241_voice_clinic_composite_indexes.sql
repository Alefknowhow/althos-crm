-- Item 6 da auditoria de performance (suspeita genérica validada contra
-- queries reais): voice_calls e clinic_medical_records tinham só índice
-- mono-coluna em organization_id, mas o padrão de acesso real (confirmado
-- por leitura de actions/voice-calls.ts, actions/voice-analytics.ts,
-- actions/voice-team.ts, actions/clinic-medical-records.ts) sempre filtra
-- organization_id + created_at (voice_calls) ou organization_id +
-- patient_contato_id (clinic_medical_records) juntos.

CREATE INDEX IF NOT EXISTS idx_voice_calls_org_created_at
  ON voice_calls (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinic_medical_records_org_patient
  ON clinic_medical_records (organization_id, patient_contato_id)
  WHERE deleted_at IS NULL;
