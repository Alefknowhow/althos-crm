-- Status (enviada/entregue/lida/falhou) da última mensagem de saída — pra
-- mostrar o "tick" de confirmação ao lado do horário na lista de conversas,
-- sem precisar de um join com whatsapp_messages por linha.
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS last_message_status TEXT;
