-- Guarda o horário da última mensagem INBOUND (do cliente) separado de
-- last_message_at (que é bumpado nos dois sentidos) — é o que marca o
-- início da janela grátis de 24h da API oficial do WhatsApp, usado pra
-- mostrar a contagem regressiva na tela de Conversas.
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;

UPDATE whatsapp_conversations
  SET last_inbound_at = last_message_at
  WHERE last_inbound_at IS NULL AND last_message_direction = 'inbound';
