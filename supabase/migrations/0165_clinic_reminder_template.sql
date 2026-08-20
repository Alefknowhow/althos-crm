-- Nome do template WhatsApp usado pelo lembrete automático de agendamento
-- (24h antes) da vertical Clínicas. NULL = lembrete desligado (nenhum
-- template configurado ainda). O cron (lib/inngest/clinic-crons.ts) só
-- envia quando esse template existir E estiver com status='approved' em
-- whatsapp_templates — nunca manda fora da janela de 24h sem template
-- aprovado pela Meta.
ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS clinic_reminder_template_name TEXT;

COMMENT ON COLUMN org_settings.clinic_reminder_template_name IS
  'Nome (whatsapp_templates.name) do template usado pelo lembrete automático de agendamento 24h antes. NULL = lembrete desligado.';
