-- Althos Voice — Fase 2: SMS.
CREATE TABLE IF NOT EXISTS sms_messages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contato_id         uuid REFERENCES contatos(id) ON DELETE SET NULL,
  direction          text NOT NULL,                 -- inbound | outbound
  from_number        text NOT NULL,
  to_number          text NOT NULL,
  body               text NOT NULL,
  provider           text NOT NULL DEFAULT 'twilio',
  provider_message_id text,
  status             text NOT NULL DEFAULT 'queued', -- queued | sent | delivered | failed | received
  segments           integer NOT NULL DEFAULT 1,
  provider_cost_cents integer NOT NULL DEFAULT 0,
  althos_cost_cents   integer NOT NULL DEFAULT 0,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_messages_org ON sms_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_contato ON sms_messages(contato_id);

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sms messages access" ON sms_messages;
CREATE POLICY "Sms messages access" ON sms_messages FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
DROP POLICY IF EXISTS "Sms messages super admin" ON sms_messages;
CREATE POLICY "Sms messages super admin" ON sms_messages FOR ALL USING ((SELECT is_super_admin()));

COMMENT ON TABLE sms_messages IS 'Althos Voice: histórico de SMS enviados/recebidos, cobrados via voice_credit_transactions (usage_type=sms).';
