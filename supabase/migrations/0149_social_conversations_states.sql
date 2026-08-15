-- Mesma paridade de estados que o WhatsApp já tem (arquivar, silenciar,
-- fixar, favoritar) + status da última mensagem (pro tick de confirmação).
-- "blocked" aqui é só local — a API de mensagens do Instagram/Messenger não
-- tem um endpoint de bloqueio de usuário como a do WhatsApp; então bloquear
-- só impede o CRM de mandar mensagem pra esse contato, não bloqueia de
-- verdade do lado da Meta.
ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS last_message_status TEXT;

CREATE INDEX IF NOT EXISTS idx_social_conversations_pinned ON social_conversations(organization_id, pinned) WHERE pinned = true;

-- Tipo de mídia (pra saber renderizar como imagem/áudio/vídeo/documento sem
-- adivinhar pela URL) + status de entrega/leitura por mensagem.
ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS status TEXT;
