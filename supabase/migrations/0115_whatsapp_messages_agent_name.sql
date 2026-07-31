-- Nome do atendente logado que enviou a mensagem manual — mesmo padrão já
-- usado em social_messages.sent_by_name (Instagram). Só visível no CRM.
alter table public.whatsapp_messages
  add column if not exists sent_by_name text;
