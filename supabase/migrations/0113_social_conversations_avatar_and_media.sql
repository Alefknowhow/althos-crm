-- Foto de perfil do contato na lista de DMs, e suporte a mensagens de imagem
-- no inbox do Instagram (compositor ganha anexo de foto além de emojis).
alter table public.social_conversations
  add column if not exists sender_avatar_url text;

alter table public.social_messages
  add column if not exists media_url text;
