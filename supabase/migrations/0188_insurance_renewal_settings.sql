ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS insurance_renewal_reminder_days INTEGER[] NOT NULL DEFAULT '{60,30,15}';

ALTER TABLE insurance_policies
  ADD COLUMN IF NOT EXISTS renewal_reminder_days_sent INTEGER[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN org_settings.insurance_renewal_reminder_days IS
  'Vertical Seguros (Fase 4) — dias de antecedência pra lembrete de renovação de apólice (ex.: {120,90,60,30,15}). Configurável, editado em /apolices.';
COMMENT ON COLUMN insurance_policies.renewal_reminder_days_sent IS
  'Thresholds de dias já notificados pro cron de renovação, evita duplicar tarefa no mesmo threshold.';
