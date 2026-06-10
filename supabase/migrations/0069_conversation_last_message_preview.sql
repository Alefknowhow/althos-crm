-- Prévia da última mensagem na própria conversa (modelo WhatsApp Business).
--
-- O inbox precisa mostrar a última mensagem + horário sem ter que carregar
-- todas as mensagens de cada conversa. Em vez de um "latest-per-group" caro a
-- cada render, denormalizamos: cada conversa guarda o texto-resumo e a direção
-- da última mensagem, atualizados no momento em que a mensagem é inserida.

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS last_message_preview   TEXT,
  ADD COLUMN IF NOT EXISTS last_message_direction TEXT;

-- Backfill a partir da mensagem mais recente de cada conversa.
UPDATE whatsapp_conversations c
SET
  last_message_preview   = sub.preview,
  last_message_direction = sub.direction
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    direction,
    COALESCE(
      content->'text'->>'body',
      content->>'body',
      CASE type
        WHEN 'image'    THEN '📷 Foto'
        WHEN 'audio'    THEN '🎤 Áudio'
        WHEN 'video'    THEN '🎬 Vídeo'
        WHEN 'document' THEN '📄 Documento'
        WHEN 'sticker'  THEN 'Figurinha'
        WHEN 'location' THEN '📍 Localização'
        ELSE '[Mídia]'
      END
    ) AS preview
  FROM whatsapp_messages
  ORDER BY conversation_id, created_at DESC
) sub
WHERE c.id = sub.conversation_id;
