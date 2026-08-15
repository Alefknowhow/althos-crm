-- Rastreia o template real na Meta (id retornado por POST /message_templates)
-- e o motivo de rejeição, pra exibir na UI sem precisar consultar a API toda
-- vez.
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS meta_template_id TEXT;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
