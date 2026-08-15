-- Estado da IA por conversa no WhatsApp — mesmo padrão já usado no Instagram
-- (social_conversations.automation_paused): permite ligar a IA globalmente
-- (ai_attendant_config.is_enabled) e mesmo assim um atendente assumir uma
-- conversa específica manualmente sem desligar a IA pras demais.
alter table public.whatsapp_conversations
  add column if not exists automation_paused boolean not null default false;

-- Contador de respostas da IA nesta conversa — evita loop/gasto
-- descontrolado, respeitando o teto configurado em
-- ai_attendant_config.max_replies_per_conversation (campo que já existia,
-- mas nunca era aplicado em lugar nenhum).
alter table public.whatsapp_conversations
  add column if not exists ai_replies_count integer not null default 0;
