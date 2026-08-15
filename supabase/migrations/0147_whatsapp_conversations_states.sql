-- Estados de conversa estilo WhatsApp Business App (arquivar, silenciar,
-- fixar, favoritar, bloquear) — conceitos só do nosso CRM, a API oficial do
-- WhatsApp não tem "conversas" com esse tipo de estado.
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false;
-- blocked É real: espelha o bloqueio feito via API oficial (POST
-- /{phone_number_id}/block_users), não é só uma flag decorativa.
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_pinned ON whatsapp_conversations(organization_id, pinned) WHERE pinned = true;
