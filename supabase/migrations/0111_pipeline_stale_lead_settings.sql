-- Unifica o limite de "lead parado" (hoje hardcoded em 7 dias em dois
-- lugares diferentes: components/features/LeadCard.tsx e
-- actions/dashboard.ts::getAtRiskLeads) num único valor configurável por
-- organização, e adiciona um opt-in para fechar automaticamente leads
-- parados além do limite. O alerta visual existente continua funcionando
-- exatamente como hoje quando o opt-in estiver desligado (fallback padrão).
--
-- Idempotente.

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS stale_lead_days INTEGER NOT NULL DEFAULT 7
    CHECK (stale_lead_days > 0),
  ADD COLUMN IF NOT EXISTS auto_close_stale_leads BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN org_settings.stale_lead_days IS
  'Dias sem atividade (last_activity_at) para um lead aberto ser considerado "parado". Usado pelo badge visual do card e, se auto_close_stale_leads=true, pela automação diária de fechamento.';
COMMENT ON COLUMN org_settings.auto_close_stale_leads IS
  'Se true, o cron diário (lib/inngest/pipeline-crons.ts) move automaticamente leads abertos parados há mais de stale_lead_days para deal_status=perdido, close_reason=sem_resposta. Se false (padrão), o alerta continua só visual, como hoje.';
