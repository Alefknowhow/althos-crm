-- waba_id é necessário pra chamar a API de templates (POST/GET
-- /{waba_id}/message_templates) — diferente do phone_number_id, que só
-- serve pra enviar mensagens.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS whatsapp_waba_id TEXT;
